/**
 * VideoExport handlers — split from VideoExport.tsx
 * 14 useState 集中化入口 (v3.4 §A2 范式)
 */
import { useMemo, useCallback, useEffect } from 'react';
import { useReducerHookFactory } from '@/shared/hooks/use-reducer-hook';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { tauri } from '@/core/tauri';
import { notify } from '@/shared';
import { logger } from '@/shared/utils/logging';
import type { ExportSettings } from '@/types';
import type { Updater } from '@/shared/hooks/use-auto-setters';
import { PLATFORM_PRESETS } from './export-config';
import {
  initialExportHandlersState,
  exportHandlersReducer,
  type ExportHandlersAction,
  type ExportHandlersState,
} from './use-export-handlers-reducer';

/** 画质档位 → x264 CRF（越低画质越高）。ultra 视作 high，custom 取默认。 */
const QUALITY_CRF: Record<string, number> = { low: 28, medium: 23, high: 18, ultra: 18 };
const crfForQuality = (quality: string): number => QUALITY_CRF[quality] ?? 23;

/** 将导出配置映射为 export_video 命令入参 */
function buildExportInput(
  inputPath: string,
  outputPath: string,
  config: ExportSettings,
): Parameters<typeof tauri.exportVideo>[0] {
  return {
    inputPath,
    outputPath,
    format: config.format,
    videoCodec: 'h264',
    audioCodec: 'aac',
    crf: crfForQuality(config.quality),
    subtitleEnabled: config.includeSubtitles,
    burnSubtitles: config.burnSubtitles ?? false,
  };
}

interface UseExportHandlersProps {
  state: {
    synthesisData?: { finalVideoUrl?: string };
    currentVideo?: { duration?: number };
    exportSettings?: Partial<ExportSettings>;
  };
  onExportSettingsChange: (settings: ExportSettings) => void;
  onComplete?: () => void;
}

interface ExportHandlers {
  exporting: boolean;
  progress: number;
  progressStage: string;
  etaSeconds: number | null;
  exported: boolean;
  exportedFile: string | null;
  exportError: string | null;
  selectedPlatform: string | null;
  batchMode: boolean;
  selectedPlatforms: string[];
  currentExportId: string | null;
  config: ExportSettings;
  estimateFileSize: () => string;
  getEstimatedFileSize: () => string;
  setConfig: React.Dispatch<React.SetStateAction<ExportSettings>>;
  setSelectedPlatform: (v: string | null) => void;
  setBatchMode: (v: boolean) => void;
  handleExport: () => Promise<void>;
  handleBatchExport: () => Promise<void>;
  handleCancel: () => Promise<void>;
  togglePlatformSelection: (value: string) => void;
}

type Setter<K extends keyof ExportHandlersState> = (
  updater: Updater<ExportHandlersState[K]>,
) => void;
type ExportHandlersSetters = { [K in keyof ExportHandlersState]: Setter<K> };

const makeSetters = (
  dispatch: React.Dispatch<ExportHandlersAction>,
  state: ExportHandlersState,
): ExportHandlersSetters => {
  return Object.fromEntries(
    (Object.keys(state) as (keyof ExportHandlersState)[]).map((key) => [
      key,
      (updater: Updater<ExportHandlersState[typeof key]>) =>
        dispatch({ type: 'update', key, updater: updater as Updater<unknown> }),
    ]),
  ) as ExportHandlersSetters;
};

export function useExportHandlers({
  state,
  onExportSettingsChange,
  onComplete,
}: UseExportHandlersProps): ExportHandlers {
  const { state: ehState, dispatch } = useReducerHookFactory(
    exportHandlersReducer,
    initialExportHandlersState({ exportSettings: state.exportSettings }),
  );
  const setters = useMemo(() => makeSetters(dispatch, ehState), [dispatch, ehState]);
  const {
    exporting, progress, progressStage, etaSeconds,
    exported, exportedFile, exportError,
    selectedPlatform, batchMode, selectedPlatforms,
    currentExportId, config,
  } = ehState;

  // 监听 Rust processing-progress 事件
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;
    if (exporting) {
      listen<{ stage: string; progress: number; time_remaining_secs?: number }>(
        'processing-progress',
        (event) => {
          const { stage, progress, time_remaining_secs } = event.payload;
          setters.progress(Math.round(progress * 100));
          setters.progressStage(stage);
          if (time_remaining_secs !== undefined) {
            setters.etaSeconds(Math.round(time_remaining_secs));
          }
        },
      )
        .then((fn) => {
          // If cleanup already ran before listen() resolved, unlisten immediately
          if (cancelled) {
            fn();
          } else {
            unlisten = fn;
          }
        })
        .catch((err) => {
          logger.error('[useExportHandlers] Failed to subscribe to processing-progress', err);
        });
    }
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [exporting, setters]);

  const handleCancel = useCallback(async () => {
    if (!currentExportId) return;
    try {
      await tauri.cancelExport(currentExportId);
      notify.info('导出已取消');
    } catch {
      notify.error(new Error('取消导出失败'), '取消失败');
    }
    setters.exporting(false);
    setters.progress(0);
    setters.progressStage('');
    setters.etaSeconds(null);
    setters.currentExportId(null);
  }, [currentExportId, setters]);

  const estimateFileSize = useCallback(() => {
    if (!state.currentVideo?.duration) return '0 MB';
    const bitrateMap: Record<string, number> = { low: 1.5, medium: 4, high: 10, ultra: 30 };
    const bitrate = bitrateMap[config.quality] || 5;
    const sizeMB = (bitrate * state.currentVideo.duration) / 8;
    return sizeMB > 1000 ? `${(sizeMB / 1000).toFixed(1)} GB` : `${sizeMB.toFixed(1)} MB`;
  }, [state.currentVideo?.duration, config.quality]);

  const getEstimatedFileSize = useCallback(() => {
    if (!state.currentVideo?.duration) return '0 MB';
    const platform = PLATFORM_PRESETS.find((p) => p.value === selectedPlatform);
    const bitrate =
      platform?.bitrate ||
      (config.quality === 'low'
        ? 1.5
        : config.quality === 'medium'
        ? 4
        : config.quality === 'high'
        ? 10
        : 30);
    const sizeMB = (bitrate * state.currentVideo.duration) / 8;
    return sizeMB > 1000 ? `${(sizeMB / 1000).toFixed(1)} GB` : `${sizeMB.toFixed(1)} MB`;
  }, [state.currentVideo?.duration, selectedPlatform, config.quality]);

  const handleExport = useCallback(async () => {
    if (!state.synthesisData?.finalVideoUrl) {
      notify.warning('请先完成视频合成');
      return;
    }

    setters.exporting(true);
    setters.progress(0);
    setters.progressStage('准备导出...');
    setters.etaSeconds(null);
    setters.exportError(null);

    try {
      const outputPath = `/tmp/fablr/export_${Date.now()}.mp4`;
      setters.currentExportId(outputPath);

      setters.progressStage('正在编码...');

      await tauri.exportVideo(
        buildExportInput(state.synthesisData.finalVideoUrl ?? '', outputPath, config),
      );

      setters.progress(100);
      setters.progressStage('导出完成');
      setters.etaSeconds(0);

      onExportSettingsChange(config);
      setters.exportedFile(outputPath);
      setters.exported(true);
      notify.success('视频导出完成！');
      onComplete?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setters.exportError(msg);
      notify.error(msg, '导出失败');
    } finally {
      setters.exporting(false);
    }
  }, [
    state.synthesisData?.finalVideoUrl,
    config,
    onExportSettingsChange,
    onComplete,
    setters,
  ]);

  const handleBatchExport = useCallback(async () => {
    if (!state.synthesisData?.finalVideoUrl) {
      notify.warning('请先完成视频合成');
      return;
    }
    if (selectedPlatforms.length === 0) {
      notify.warning('请至少选择一个发布平台');
      return;
    }

    setters.exporting(true);
    setters.progress(0);
    setters.etaSeconds(null);

    try {
      for (let i = 0; i < selectedPlatforms.length; i++) {
        const platform = PLATFORM_PRESETS.find((p) => p.value === selectedPlatforms[i]);
        if (!platform) continue;

        const outputPath = `/tmp/fablr/export_${platform.value}_${Date.now()}.mp4`;
        setters.currentExportId(outputPath);
        setters.progressStage(
          `${platform.emoji} ${platform.label} 导出中... (${i + 1}/${selectedPlatforms.length})`,
        );

        const exportConfig: ExportSettings = {
          ...config,
          resolution: platform.resolution as ExportSettings['resolution'],
        };
        onExportSettingsChange(exportConfig);

        await tauri.exportVideo(
          buildExportInput(state.synthesisData.finalVideoUrl ?? '', outputPath, exportConfig),
        );

        setters.progress(Math.round(((i + 1) / selectedPlatforms.length) * 100));
      }

      setters.progress(100);
      setters.progressStage('全部导出完成');
      setters.etaSeconds(0);
      setters.exported(true);
      notify.success(`批量导出完成！共 ${selectedPlatforms.length} 个平台`);
      onComplete?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setters.exportError(msg);
      notify.error(msg, '批量导出失败');
    } finally {
      setters.exporting(false);
    }
  }, [
    state.synthesisData?.finalVideoUrl,
    selectedPlatforms,
    config,
    onExportSettingsChange,
    onComplete,
    setters,
  ]);

  const togglePlatformSelection = useCallback(
    (value: string) => {
      setters.selectedPlatforms((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );
    },
    [setters],
  );

  // setConfig setter needs to keep React.Dispatch<React.SetStateAction<ExportSettings>> signature
  const setConfig = useCallback<React.Dispatch<React.SetStateAction<ExportSettings>>>(
    (updater) => {
      if (typeof updater === 'function') {
        setters.config((prev) => (updater as (p: ExportSettings) => ExportSettings)(prev));
      } else {
        setters.config(updater);
      }
    },
    [setters],
  );

  return {
    exporting,
    progress,
    progressStage,
    etaSeconds,
    exported,
    exportedFile,
    exportError,
    selectedPlatform,
    batchMode,
    selectedPlatforms,
    currentExportId,
    config,
    estimateFileSize,
    getEstimatedFileSize,
    setConfig,
    setSelectedPlatform: setters.selectedPlatform,
    setBatchMode: setters.batchMode,
    handleExport,
    handleBatchExport,
    handleCancel,
    togglePlatformSelection,
  };
}
