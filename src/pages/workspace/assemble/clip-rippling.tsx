/**
 * ClipRepurpose — AI 长视频 → 多短片段自动拆条
 *
 * 使用 ClipRepurposingPipeline：
 *   1. 分析视频 → 识别高光候选片段
 *   2. 多维评分 → 排序选择最佳片段（6维：笑声/情感/完整度/静默/节奏/关键词）
 *   3. SEO 元数据生成 → 每片段标题/描述/hashtags
 *   4. 多格式导出 → 9:16 / 1:1 / 16:9（新增）
 *
 * @design-system AI Cinema Studio
 *   bg-base: #08080a | accent: #c8956c | cyan: #5a9e9e
 */

import React, { useCallback, memo, useMemo } from 'react';
import { useProjectStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { notify } from '@/shared';
import { formatTime } from '@/shared/utils/formatting';
import { Zap, CheckCircle, Download } from 'lucide-react';
import { tauri } from '@/core/tauri';
import { motion } from '@/components/common/motion-shim';
import { ClipRepurposingPipeline } from '@/core/services/pipeline/clip-pipeline/pipeline';
import type { VideoInfo, VideoAnalysis } from '@/types';
import type { RepurposingOptions } from '@/core/services/pipeline/clip-pipeline/pipeline';
import { transcodeWithCrop } from '@/core/services/export/transcode-crop-service';
import styles from './clip-rippling.module.less';
import {
  MIN_CLIP_DURATION_SECONDS,
  MAX_CLIP_DURATION_SECONDS,
  TARGET_CLIP_COUNTS,
  SEO_DESCRIPTION_MAX_LENGTH,
  HASHTAGS_MAX_COUNT,
  MOTION_SCALE_HOVER,
  MOTION_SCALE_TAP,
  DEFAULT_FPS,
  PLATFORM_OPTIONS,
  FORMAT_OPTIONS,
  type SocialPlatform,
  type AspectRatio,
} from '../shared/clip-rippling-config';
import { useClipRippling } from './use-clip-rippling';

interface ClipRepurposeProps {
  onNext?: () => void;
}

const ClipRepurpose: React.FC<ClipRepurposeProps> = memo(({ onNext }) => {
  const { state: storyState } = useProjectStore();
  const { currentVideo, analysis } = storyState;
  const videoPath = currentVideo?.path ?? '';
  const videoInfo = useMemo<VideoInfo>(
    () =>
      currentVideo
        ? {
            id: currentVideo.id || `video_${Date.now()}`,
            name: currentVideo.name || 'video',
            path: currentVideo.path,
            duration: currentVideo.duration,
            width: currentVideo.width ?? 1920,
            height: currentVideo.height ?? 1080,
            size: currentVideo.size || 0,
            fps: DEFAULT_FPS,
            format: 'mp4',
          }
        : {
            id: '',
            name: '',
            path: '',
            duration: 0,
            width: 1920,
            height: 1080,
            size: 0,
            fps: DEFAULT_FPS,
            format: 'mp4',
          },
    [currentVideo]
  );

  // All UI/data state centralized in reducer
  const {
    state,
    setPlatform,
    toggleSelectedFormat,
    setTargetCount,
    setRunning,
    setProgress,
    setStage,
    setResults,
    setSelectedClips,
    toggleClip,
    setExporting,
    setExportedPaths,
    resetRun,
  } = useClipRippling();

  const {
    platform,
    selectedFormats,
    targetCount,
    running,
    progress,
    stage,
    results,
    selectedClips,
    exporting,
    exportedPaths,
  } = state;

  const handleRun = useCallback(async () => {
    if (!videoPath || !videoInfo) {
      notify.warning('请先上传视频并完成分析');
      return;
    }

    resetRun();

    try {
      const pipeline = new ClipRepurposingPipeline();
      const options: RepurposingOptions = {
        targetClipCount: targetCount,
        minClipDuration: MIN_CLIP_DURATION_SECONDS,
        maxClipDuration: MAX_CLIP_DURATION_SECONDS,
        platform,
        exportFormats: selectedFormats,
        multiFormat: false, // 前端自行调用 transcodeWithCrop
        generateSEO: true,
        onProgress: (stg, prog, msg) => {
          setStage(stg);
          setProgress(prog);
          if (msg) notify.info(msg);
        },
      };

      const result = await pipeline.run(videoInfo, analysis ?? ({} as VideoAnalysis), options);

      setResults(result.clips);
      // 默认全选
      setSelectedClips(
        new Set(result.clips.map(c => c.clip.id).filter((id): id is string => id !== undefined))
      );
      notify.success(`生成 ${result.clips.length} 个短片段`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify.error(`拆条失败: ${msg}`, '拆条失败');
    } finally {
      setRunning(false);
    }
  }, [
    videoPath,
    videoInfo,
    analysis,
    platform,
    selectedFormats,
    targetCount,
    resetRun,
    setStage,
    setProgress,
    setResults,
    setSelectedClips,
    setRunning,
  ]);

  const handleExport = useCallback(async () => {
    if (selectedClips.size === 0) {
      notify.warning('请先选择要导出的片段');
      return;
    }
    if (selectedFormats.length === 0) {
      notify.warning('请至少选择一种导出格式');
      return;
    }

    setExporting(true);
    const exported: string[] = [];
    const clipsToExport = results.filter(
      c => c.clip.id !== undefined && selectedClips.has(c.clip.id)
    );

    // 动态获取导出目录
    const exportDir = await tauri.getExportDir().catch(() => '/tmp/fablr');

    try {
      for (const clip of clipsToExport) {
        for (const fmt of selectedFormats) {
          const filename = `clip_${clip.clip.id}_${fmt.replace(':', 'x')}.mp4`;
          const outputPath = await transcodeWithCrop({
            inputPath: videoPath,
            outputPath: `${exportDir}/${filename}`,
            aspect: fmt,
            startTime: clip.clip.startTime,
            endTime: clip.clip.endTime,
            quality: 'high',
          });
          exported.push(outputPath);
        }
      }
      setExportedPaths(exported);
      notify.success(`导出完成！共 ${exported.length} 个文件`);
      if (exported.length > 0) onNext?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify.error(`导出失败: ${msg}`, '导出失败');
    } finally {
      setExporting(false);
    }
  }, [results, selectedClips, selectedFormats, videoPath, onNext, setExporting, setExportedPaths]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span aria-hidden="true">🎬</span> AI 智能拆条
        </h2>
        <p className={styles.subtitle}>
          长视频 → 多段精彩短片段，自动识别高光 · 多维评分 · 多格式导出
        </p>
      </div>

      {/* 控制面板 */}
      <div className={styles.controls}>
        <div className={styles.controlRow}>
          <label className={styles.label}>目标平台</label>
          <Select
            value={String(platform)}
            onValueChange={(v: string | null) => setPlatform(v as SocialPlatform)}
          >
            <SelectTrigger className={styles.select}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  {o.emoji} {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.controlRow}>
          <label className={styles.label}>目标片段数</label>
          <Select
            value={String(targetCount)}
            onValueChange={(v: string | null) => setTargetCount(Number(v))}
          >
            <SelectTrigger className={styles.select}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_CLIP_COUNTS.map(n => (
                <SelectItem key={n} value={String(n)}>
                  {n} 个
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.controlRow}>
          <label className={styles.label}>导出格式</label>
          <div className={styles.formatTags}>
            {FORMAT_OPTIONS.map(fmt => (
              <Badge
                key={fmt.value}
                color={selectedFormats.includes(fmt.value as AspectRatio) ? 'orange' : 'default'}
                onClick={() => toggleSelectedFormat(fmt.value as AspectRatio)}
                className={`${styles.actionBtn} ${selectedFormats.includes(fmt.value as AspectRatio) ? 'bg-accent-primary' : ''}`}
              >
                {fmt.emoji} {fmt.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* 执行按钮 + 进度 */}
      <div className={styles.runSection}>
        {!running && results.length === 0 && (
          <Button
            onClick={handleRun}
            className={`${styles.runButton} bg-accent-primary hover:bg-accent-primary-hover text-primary-foreground w-full`}
          >
            <Zap className="mr-1" />
            开始 AI 拆条分析
          </Button>
        )}

        {running && (
          <div className={styles.progressSection}>
            <Progress
              value={Math.round(progress)}
              className="[&_[data-slot=slider-track]]:bg-accent-primary/20"
            />
            <p className={styles.progressStage}>
              {stage === 'analyzing' && (
                <>
                  <span aria-hidden="true">🔍</span> 识别高光片段...
                </>
              )}
              {stage === 'scoring' && (
                <>
                  <span aria-hidden="true">📊</span> 多维评分中...
                </>
              )}
              {stage === 'generating_seo' && (
                <>
                  <span aria-hidden="true">✨</span> 生成 SEO 元数据...
                </>
              )}
              {stage === 'exporting' && (
                <>
                  <span aria-hidden="true">📦</span> 准备导出...
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* 片段列表 */}
      {results.length > 0 && (
        <div className={styles.clipsSection}>
          <div className={styles.clipsHeader}>
            <span className={styles.clipsTitle}>
              📋 生成 {results.length} 个短片段
              <Badge
                variant="default"
                className={`bg-accent-success/15 text-accent-success ${styles.badgeMarginLeft}`}
              >
                已选 {selectedClips.size} 个
              </Badge>
            </span>
            <Button
              className="bg-accent-primary hover:bg-accent-primary-hover text-primary-foreground"
              onClick={handleExport}
              disabled={selectedClips.size === 0 || exporting}
            >
              <Download className="mr-1" />
              导出选中片段
            </Button>
          </div>

          <div className={styles.clipsList}>
            {results.map(clip => {
              const { clip: c, score, seo } = clip;
              const startStr = formatTime(c.startTime);
              const endStr = formatTime(c.endTime);
              const duration = c.endTime - c.startTime;
              const clipId = c.id ?? `clip_${c.startTime}_${c.endTime}`;
              const isSelected = selectedClips.has(clipId);

              return (
                <motion.div
                  key={clipId}
                  className={`${styles.clipCard} ${isSelected ? styles.clipSelected : ''}`}
                  onClick={() => toggleClip(clipId)}
                  whileHover={{ scale: MOTION_SCALE_HOVER }}
                  whileTap={{ scale: MOTION_SCALE_TAP }}
                >
                  <div className={styles.clipHeader}>
                    <Checkbox checked={isSelected} />
                    <span className={styles.clipTime}>
                      ⏱ {startStr} → {endStr}
                      <Badge className={styles.badgeMarginLeftSmall}>{duration.toFixed(0)}s</Badge>
                    </span>
                    <span className={`${styles.clipScore} ${styles.scoreText}`}>
                      {score.totalScore.toFixed(0)}
                    </span>
                  </div>

                  {/* 评分雷达 */}
                  <div className={styles.scoreDims}>
                    {Object.entries(score.dimensions ?? {}).map(([dim, val]) => (
                      <div key={dim} className={styles.dimBar}>
                        <span className={styles.dimLabel}>{dimLabel(dim)}</span>
                        <Progress value={Math.round(val)} className="flex-1 min-w-[60px]" />
                        <span className={styles.dimScore}>{Math.round(val)}</span>
                      </div>
                    ))}
                  </div>

                  {/* SEO 元数据 */}
                  {seo && (
                    <div className={styles.seoSection}>
                      <p className={styles.seoTitle}>📝 {seo.title}</p>
                      <p className={styles.seoDesc}>
                        {seo.description?.slice(0, SEO_DESCRIPTION_MAX_LENGTH)}...
                      </p>
                      <div className={styles.hashtags}>
                        {seo.hashtags?.slice(0, HASHTAGS_MAX_COUNT).map(tag => (
                          <Badge
                            key={tag}
                            variant="default"
                            className={`bg-accent-secondary/15 text-accent-secondary ${styles.tagBadge}`}
                          >
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* 已导出文件 */}
          {exportedPaths.length > 0 && (
            <div className={styles.exportedSection}>
              <CheckCircle className={styles.successIcon} />
              <span className={styles.successText}>已导出 {exportedPaths.length} 个文件</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Helper: 维度中文名
function dimLabel(dim: string): string {
  const map: Record<string, string> = {
    laughterDensity: '笑声',
    emotionPeak: '情感',
    speechCompleteness: '完整度',
    silenceRatio: '静默比',
    speakingPace: '节奏',
    keywordBoost: '关键词',
  };
  return map[dim] ?? dim;
}

ClipRepurpose.displayName = 'ClipRepurpose';
export default ClipRepurpose;
