/**
 * 视频分析 Hook
 *
 * 【优化思路】从 ProjectEdit/index.tsx (428行) 提取视频分析的多阶段流程，
 * 将元数据分析→关键帧提取→AI理解→脚本生成的编排逻辑独立为 Hook，
 * 降低页面组件复杂度，提升可测试性。
 */

import { useCallback, useRef, useState } from 'react';
import type { ScriptSegment } from '@/types';
import { videoProcessor, VideoMetadata } from '@/core/video';
import { generateScriptWithOpenAI, analyzeKeyFramesWithAI } from '@/core/services/ai/script-service';
import { notify } from '@/shared';
import { logger } from '@/shared/utils/logging';
import { parseScriptText } from '../project-edit-utils';

/** 分析阶段标签 */
const ANALYSIS_STAGE_LABELS: Record<string, string> = {
  metadata: '视频元数据分析',
  keyframes: '关键帧提取',
  'frames-ai': '关键帧内容理解',
  script: '脚本生成',
};

type AnalysisStage = keyof typeof ANALYSIS_STAGE_LABELS;

interface UseVideoAnalysisOptions {
  videoPath: string;
  videoMetadata: VideoMetadata | null;
  onMetadataReady: (meta: VideoMetadata) => void;
  onKeyFramesReady: (frames: string[]) => void;
  onScriptReady: (segments: ScriptSegment[]) => void;
  onNavigateToScript: () => void;
}

export function useVideoAnalysis({
  videoPath,
  videoMetadata,
  onMetadataReady,
  onKeyFramesReady,
  onScriptReady,
  onNavigateToScript,
}: UseVideoAnalysisOptions) {
  const [loading, setLoading] = useState(false);
  const analyzingLockRef = useRef(false);

  /**
   * 执行多阶段视频分析流程：
   * 1. 分析视频元数据
   * 2. 提取关键帧
   * 3. AI 理解关键帧内容
   * 4. 生成解说脚本
   */
  const analyzeVideo = useCallback(async () => {
    if (loading || analyzingLockRef.current || !videoPath) {
      if (!videoPath) notify.error(null, '请先选择视频');
      return;
    }

    analyzingLockRef.current = true;
    let stage: AnalysisStage = 'metadata';

    try {
      setLoading(true);

      // 阶段 1: 获取视频元数据（如有缓存则跳过）
      let meta = videoMetadata;
      if (!meta) {
        stage = 'metadata';
        notify.info('正在分析视频元数据...');
        meta = await videoProcessor.analyze(videoPath);
        onMetadataReady(meta);
      }

      // 阶段 2: 提取关键帧
      stage = 'keyframes';
      notify.info('正在提取关键帧...');
      let paths: string[] = [];
      try {
        const frames = await videoProcessor.extractKeyFrames(videoPath, {}, meta.duration);
        paths = frames.map((f) => f.path).filter(Boolean);
      } catch (err) {
        logger.warn('提取关键帧异常，降级处理:', { error: err });
      }

      if (paths.length > 0) {
        onKeyFramesReady(paths);
      } else {
        notify.info('未提取到镜头关键帧，继续进行智能脚本生成');
      }

      // 阶段 3: AI 分析关键帧内容
      let descriptions: string[] = [];
      if (paths.length > 0) {
        stage = 'frames-ai';
        notify.info('正在分析关键帧内容...');
        try {
          descriptions = await analyzeKeyFramesWithAI(paths);
        } catch (err) {
          logger.warn('AI 关键帧分析失败，继续生成基础脚本:', { error: err });
        }
      }

      // 阶段 4: 生成解说脚本
      stage = 'script';
      notify.info('正在根据视频内容生成脚本...');
      let text = '';
      try {
        text = await generateScriptWithOpenAI(meta, descriptions, {
          style: '自然流畅', tone: '专业', length: 'medium', purpose: '内容展示',
        });
      } catch (err) {
        logger.warn('AI 脚本生成失败，降级生成基础分镜:', { error: err });
      }

      // 解析脚本，兜底生成默认片段
      let script = parseScriptText(text);
      if (script.length === 0) {
        script = [{
          id: `segment_${Date.now()}`,
          startTime: 0,
          endTime: Math.max(10, Math.round(meta?.duration || 10)),
        }];
      }

      onScriptReady(script);
      notify.success('视频分析完成');
      onNavigateToScript();
    } catch (e: unknown) {
      logger.error('视频分析失败:', { error: e });
      const msg = e instanceof Error ? e.message : '未知错误';
      const label = ANALYSIS_STAGE_LABELS[stage];
      notify.error(e, msg.includes('失败') ? msg : `${label}失败：${msg}`);
    } finally {
      setLoading(false);
      analyzingLockRef.current = false;
    }
  }, [loading, videoMetadata, videoPath, onMetadataReady, onKeyFramesReady, onScriptReady, onNavigateToScript]);

  return { loading, analyzeVideo };
}
