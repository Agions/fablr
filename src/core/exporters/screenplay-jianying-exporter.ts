/**
 * core/exporters/screenplay-jianying-exporter.ts
 *
 * 视听剧本 (DramaScreenplayIR AST) -> 剪映/CapCut 原生草稿工程适配器
 *
 * 职责：
 * 1. 将 4-Agent 编译输出的 ScreenplayIR AST 与原始素材视频智能映射；
 * 2. 依据分镜时间轴划分多轨 VideoClip、VoiceoverClip、SubtitleItem；
 * 3. 自动将开场黄金 3 秒 Hook 注入开头或作为专属吸睛标题卡；
 * 4. 计算微秒时码 (1s = 1,000,000us) 并调用底层 jianYingExporter 生成原生工程。
 */

import type { DramaScreenplayIR } from '@/core/models/screenplay-ast';
import type {
  JianYingAudioClip,
  JianYingClip,
  JianYingDraftContent,
  JianYingProjectExportInput,
  JianYingSubtitleItem,
} from './jianying-exporter';
import { exportJianYingDraft } from './jianying-exporter';

export interface ScreenplayToJianYingOptions {
  sourceVideoPath: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  fps?: number;
  bgmPath?: string;
  bgmVolume?: number;
  includeHookAsSubtitleCard?: boolean;
}

/**
 * 将 ScreenplayIR AST 转换为剪映标准的工程入参对象
 */
export function convertScreenplayToJianYingInput(
  screenplay: DramaScreenplayIR,
  options: ScreenplayToJianYingOptions
): JianYingProjectExportInput {
  const fps = options.fps || 30;
  const aspectRatio = options.aspectRatio || '16:9';

  let currentTimelineUs = 0;
  const videoClips: JianYingClip[] = [];
  const voiceoverClips: JianYingAudioClip[] = [];
  const subtitles: JianYingSubtitleItem[] = [];

  // 1. 处理开场 Hook (若勾选作为独立字幕或开场)
  if (options.includeHookAsSubtitleCard && screenplay.hook) {
    const hookDurationUs = Math.round((screenplay.hook.durationSec || 4) * 1_000_000);
    subtitles.push({
      id: `sub_hook_${screenplay.projectId}`,
      text: `【${screenplay.hook.headline}】${screenplay.hook.openingText}`,
      startTimeUs: 0,
      durationUs: hookDurationUs,
    });
  }

  // 2. 依次映射所有分镜节拍
  screenplay.sceneBeats.forEach((beat, index) => {
    const beatDurationSec = Math.max(0.5, beat.endTimeSec - beat.startTimeSec);
    const durationUs = Math.round(beatDurationSec * 1_000_000);
    const sourceInUs = Math.round(beat.startTimeSec * 1_000_000);
    const sourceOutUs = sourceInUs + durationUs;

    // 视频轨道剪辑项
    videoClips.push({
      id: beat.id || `clip_${index + 1}`,
      sourcePath: options.sourceVideoPath,
      startTimeUs: currentTimelineUs,
      durationUs,
      sourceInUs,
      sourceOutUs,
      speed: 1.0,
    });

    // 配音音轨 (如果已有音频产物)
    if (beat.audioPath) {
      voiceoverClips.push({
        id: `vo_${beat.id}`,
        sourcePath: beat.audioPath,
        startTimeUs: currentTimelineUs,
        durationUs,
        volume: 1.0,
      });
    }

    // 字幕轨道
    const subtitleContent = beat.subtitleText || beat.voiceoverText;
    if (subtitleContent) {
      subtitles.push({
        id: `sub_${beat.id}`,
        text: subtitleContent,
        startTimeUs: currentTimelineUs,
        durationUs,
      });
    }

    currentTimelineUs += durationUs;
  });

  // 3. 背景音乐 (可选)
  const bgmClips: JianYingAudioClip[] = [];
  if (options.bgmPath && currentTimelineUs > 0) {
    bgmClips.push({
      id: `bgm_${screenplay.projectId}`,
      sourcePath: options.bgmPath,
      startTimeUs: 0,
      durationUs: currentTimelineUs,
      volume: options.bgmVolume ?? 0.25,
    });
  }

  return {
    projectName: screenplay.title || 'Fablr_Screenplay_Project',
    aspectRatio,
    fps,
    videoClips,
    voiceoverClips,
    bgmClips,
    subtitles,
  };
}

/**
 * 完整导出 ScreenplayIR 为剪映草稿工程
 */
export async function exportScreenplayToJianYing(
  screenplay: DramaScreenplayIR,
  options: ScreenplayToJianYingOptions
): Promise<{ success: boolean; filePath?: string; draft: JianYingDraftContent }> {
  const exportInput = convertScreenplayToJianYingInput(screenplay, options);
  const defaultFilename = `${(screenplay.title || 'screenplay').replace(/[/\\?%*:|"<>]/g, '_')}_draft.json`;

  return exportJianYingDraft(exportInput, defaultFilename);
}
