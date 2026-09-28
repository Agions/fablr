import { logger } from '@/shared/utils/logging';
import { isTauriEnv } from '@/shared/utils/platform';
import React, { useRef, useCallback, useEffect } from 'react';
import { useReducerHookFactory } from '@/shared/hooks/use-reducer-hook';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, PlayCircle } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { tauri } from '@/core/tauri';
import { videoProcessor, VideoMetadata, formatResolution } from '@/core/video';
import { formatDuration } from '@/shared/utils/formatting';
import { notify } from '@/shared';
import { VIDEO_EXTENSIONS } from '@/shared/constants';
import {
  videoSelectorReducer,
  initialVideoSelectorState,
} from '../video-selector-reducer';
import styles from './video-selector.module.less';

interface VideoSelectorProps {
  initialVideoPath?: string;
  onVideoSelect: (filePath: string, metadata?: VideoMetadata) => void;
  onVideoRemove?: () => void;
  loading?: boolean;
}

// 支持的视频格式（已从 @/shared/constants 导入 VIDEO_EXTENSIONS）

/**
 * 视频选择器组件
 * 支持点击选择、拖拽上传，同时支持桌面端 (Tauri) 和 Web 端
 *
 * 状态机: 5 useState → 1 useReducer (state machine)
 */
const VideoSelector: React.FC<VideoSelectorProps> = ({
  initialVideoPath,
  onVideoSelect,
  onVideoRemove,
  loading = false
}) => {
  const { state, dispatch } = useReducerHookFactory(videoSelectorReducer, {
    ...initialVideoSelectorState,
    videoPath: initialVideoPath || null,
  });
  const { videoPath, videoSrc, metadata, isAnalyzing, isDragging } = state;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  // 组件卸载时清理 blob URL
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // 获取文件名（兼容 Web 和 Tauri 环境，支持 Windows 与 POSIX 路径）
  const getFileName = useCallback((path: string | null): string => {
    if (!path) return '';
    if (path.startsWith('blob:') || path.startsWith('http')) {
      return '视频文件';
    }
    return path.split(/[/\\]/).pop() || path;
  }, []);

  // 处理视频文件（通用逻辑）
  const processVideoFile = useCallback(async (fileOrPath: string, file?: File) => {
    const runningInTauri = isTauriEnv();

    if (runningInTauri) {
      // Tauri: fileOrPath 是真实路径
      const filePath = fileOrPath;
      dispatch({ type:'SET_VIDEO_PATH', payload: filePath });
      dispatch({ type:'SET_VIDEO_SRC', payload: convertFileSrc(filePath) });

      dispatch({ type:'SET_IS_ANALYZING', payload: true });
      try {
        const videoMetadata = await videoProcessor.analyze(filePath);
        dispatch({ type:'SET_METADATA', payload: videoMetadata });
        onVideoSelect(filePath, videoMetadata);
        notify.success('视频导入并解析成功');
      } catch (error) {
        logger.error('分析视频失败:', { error });
        notify.warning('未获取到完整视频元数据，可继续使用');
        onVideoSelect(filePath);
      } finally {
        dispatch({ type:'SET_IS_ANALYZING', payload: false });
      }
    } else {
      // Web: fileOrPath 是 blob URL，file 是原始 File 对象
      const blobUrl = fileOrPath;
      dispatch({ type:'SET_VIDEO_PATH', payload: file?.name || '视频文件' });
      dispatch({ type:'SET_VIDEO_SRC', payload: blobUrl });
      blobUrlRef.current = blobUrl; // 跟踪 blob URL 以便清理

      dispatch({ type:'SET_IS_ANALYZING', payload: true });
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        const webMetadata: VideoMetadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          fps: 30,
          codec: file?.type || 'unknown',
          bitrate: video.duration > 0 && file ? Math.round((file.size * 8) / video.duration) : 0,
        };
        dispatch({ type:'SET_METADATA', payload: webMetadata });
        onVideoSelect(blobUrl, webMetadata);
        dispatch({ type:'SET_IS_ANALYZING', payload: false });
      };

      video.onerror = () => {
        notify.error(null, '无法读取视频文件');
        dispatch({ type:'SET_IS_ANALYZING', payload: false });
      };

      video.src = blobUrl;
    }
  }, [onVideoSelect, dispatch]);

  // Tauri 选择视频
  const handleSelectVideoTauri = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: '视频文件',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm']
        }]
      });

      if (!selected || Array.isArray(selected)) return;

      await processVideoFile(selected as string);
    } catch (error) {
      logger.error('选择视频失败:', { error });
      notify.error(error, '选择视频失败，请重试');
    }
  };

  // Web 文件选择
  const handleSelectVideoWeb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFile(file);
  };

  // 处理文件（验证 + 触发）
  const handleFile = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!VIDEO_EXTENSIONS.includes(ext)) {
      notify.error(null, `不支持的视频格式: ${ext}，请选择 ${VIDEO_EXTENSIONS.join(', ')} 格式`);
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    processVideoFile(blobUrl, file);
  };

  // 拖拽事件处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type:'SET_IS_DRAGGING', payload: true });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type:'SET_IS_DRAGGING', payload: false });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type:'SET_IS_DRAGGING', payload: false });

    if (isTauriEnv()) {
      // Tauri 环境下优先用对话框
      handleSelectVideoTauri();
      return;
    }

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  // 选择视频（自动判断环境）
  const handleSelectVideo = () => {
    if (isTauriEnv()) {
      handleSelectVideoTauri();
    } else {
      fileInputRef.current?.click();
    }
  };

  // 移除视频
  const handleRemoveVideo = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    dispatch({ type:'RESET', payload: undefined });
    onVideoRemove?.();
  };

  // 在默认播放器中打开
  const handlePlayVideo = async () => {
    if (!videoPath) return;

    if (isTauriEnv()) {
      try {
        await tauri.openFile(videoPath);
      } catch (error) {
        logger.error('打开视频失败:', { error });
        notify.error(error, '无法打开视频，请确保系统有关联的视频播放器');
      }
    } else {
      // Web: 在新标签页打开
      if (videoSrc) {
        window.open(videoSrc, '_blank');
      }
    }
  };

  return (
    <div className={styles.videoSelector}>
      {/* 隐藏的文件输入 - 仅 Web 端使用 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={VIDEO_EXTENSIONS.join(',')}
        style={{ display: 'none' }}
        onChange={handleSelectVideoWeb}
      />

      <div className={`relative ${loading || isAnalyzing ? 'opacity-60 pointer-events-none' : ''}`}>
        {loading || isAnalyzing ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-accent-primary/30 border-t-accent-primary animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">
              {isAnalyzing ? '分析视频中...' : '加载中...'}
            </span>
          </div>
        ) : !videoPath ? (
          <div
            className={`${styles.uploadArea} ${isDragging ? styles.dragging : ''}`}
            onClick={handleSelectVideo}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className={styles.uploadIcon} />
            <p>点击选择视频文件</p>
            <p className={styles.uploadTip}>
              支持 {VIDEO_EXTENSIONS.map((e: string) => e.slice(1).toUpperCase()).join(', ')} 格式
            </p>
            <p className={styles.uploadTip} style={{ marginTop: 4 }}>
              或拖拽文件到此处
            </p>
          </div>
        ) : (
          <div className={styles.videoPreviewContainer}>
            <div className={styles.videoPreview}>
              <video
                src={videoSrc || undefined}
                controls
                className={styles.videoPlayer}
              />
            </div>

            {metadata && (
              <Card className="mt-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">视频信息</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p><strong>文件名:</strong> {getFileName(videoPath)}</p>
                  <p><strong>时长:</strong> {formatDuration(metadata.duration)}</p>
                  <p><strong>分辨率:</strong> {formatResolution(metadata.width, metadata.height)}</p>
                  <p><strong>帧率:</strong> {metadata.fps} fps</p>
                  <p><strong>编码:</strong> {metadata.codec}</p>
                </CardContent>
              </Card>
            )}

            <div className={styles.videoActions}>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  onClick={handleRemoveVideo}
                >
                  <Trash2 className="mr-1 size-4" />
                  移除
                </Button>
                <Button
                  className="bg-accent-primary hover:bg-accent-primary-hover text-primary-foreground"
                  onClick={handlePlayVideo}
                >
                  <PlayCircle className="mr-1 size-4" />
                  {isTauriEnv() ? '在播放器中打开' : '新窗口播放'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoSelector;
