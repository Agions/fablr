import React, { useRef, useEffect, useCallback } from 'react';
import { useReducerHookFactory } from '@/shared/hooks/use-reducer-hook';
import { Slider } from '../ui/slider';
import { Button } from '../ui/button';
import { formatTime } from '../../shared/utils/formatting';
import {
  Play,
  Pause,
  Volume2,
  Maximize,
} from 'lucide-react';
import {
  videoPlayerReducer,
  initialVideoPlayerState,
} from './video-player-reducer';
import { useVideoKeyboardShortcuts } from '@/hooks/use-video-keyboard-shortcuts';
import styles from '././video-player.module.less';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  width?: number | string;
  height?: number | string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

/**
 * 视频播放器组件
 *
 * 状态机: 5 useState → 1 useReducer (state machine)
 * - isPlaying/currentTime/duration/volume/showVolumeSlider
 * - 事件驱动 setter (timeupdate/durationchange/ended/play/pause)
 */
function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  width = '100%',
  height = 'auto',
  onTimeUpdate,
  onEnded,
}: VideoPlayerProps): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useReducerHookFactory(videoPlayerReducer, initialVideoPlayerState);
  const { isPlaying, currentTime, duration, volume, showVolumeSlider } = state;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      dispatch({ type: 'SET_CURRENT_TIME', payload: videoElement.currentTime });
      onTimeUpdate?.(videoElement.currentTime);
    };

    const handleDurationChange = () => {
      dispatch({ type: 'SET_DURATION', payload: videoElement.duration });
    };

    const handleEnded = () => {
      dispatch({ type: 'SET_IS_PLAYING', payload: false });
      onEnded?.();
    };

    const handlePlay = () => dispatch({ type: 'SET_IS_PLAYING', payload: true });
    const handlePause = () => dispatch({ type: 'SET_IS_PLAYING', payload: false });

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('durationchange', handleDurationChange);
    videoElement.addEventListener('ended', handleEnded);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('durationchange', handleDurationChange);
      videoElement.removeEventListener('ended', handleEnded);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
    };
  }, [onTimeUpdate, onEnded, dispatch]);

  // Action callbacks (defined before useVideoKeyboardShortcuts to avoid TDZ)
  const togglePlay = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    if (videoElement.paused) {
      void videoElement.play();
    } else {
      videoElement.pause();
    }
  }, [videoRef]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, [containerRef]);

  // Keyboard shortcuts
  useVideoKeyboardShortcuts({
    videoRef,
    onTogglePlay: togglePlay,
    onToggleFullscreen: toggleFullscreen,
    onSeek: (seconds) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    },
    onVolumeChange: (delta) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = Math.max(0, Math.min(1, video.volume + delta));
      dispatch({ type: 'SET_VOLUME', payload: video.volume });
    },
    onToggleMute: () => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
    },
  });

  const handleSliderChange = (value: number | readonly number[]) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const val = Array.isArray(value) ? value[0] : value;
    videoElement.currentTime = val;
    dispatch({ type: 'SET_CURRENT_TIME', payload: val });
  };

  const handleVolumeChange = (value: number | readonly number[]) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const val = Array.isArray(value) ? value[0] : value;
    videoElement.volume = val;
    dispatch({ type: 'SET_VOLUME', payload: val });
  };

  return (
    <div className={styles.videoPlayerContainer} ref={containerRef}>
      <div className={styles.videoWrapper}>
        <video
          ref={videoRef}
          className={styles.videoElement}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          width={width}
          height={height}
          onClick={togglePlay}
        />
        {!isPlaying && (
          <div className={styles.centerPlayButton} onClick={togglePlay}>
            <Play />
          </div>
        )}
      </div>
      <div className={styles.controls}>
        <div className={styles.progressBar}>
          <Slider
            min={0}
            max={duration}
            value={currentTime}
            onValueChange={handleSliderChange}
          />
        </div>
        <div className={styles.controlButtons}>
          <div>
            <Button variant="ghost" className={styles.controlButton} onClick={togglePlay}>
              {isPlaying ? <Pause /> : <Play />}
            </Button>
            <span className={styles.timeDisplay}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div className={styles.rightControls}>
            <div
              className={styles.volumeControl}
              onMouseEnter={() => dispatch({ type: 'SET_SHOW_VOLUME_SLIDER', payload: true })}
              onMouseLeave={() => dispatch({ type: 'SET_SHOW_VOLUME_SLIDER', payload: false })}
            >
              <Button variant="ghost" className={styles.controlButton}>
                <Volume2 />
              </Button>
              {showVolumeSlider && (
                <div className={styles.volumeSlider}>
                  <Slider
                    className="vertical-slider"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onValueChange={handleVolumeChange}
                  />
                </div>
              )}
            </div>
            <Button variant="ghost" className={styles.controlButton} onClick={toggleFullscreen}>
              <Maximize />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
