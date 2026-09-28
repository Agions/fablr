/**
 * VideoUploadProgress — 上传进度条
 */

import React from 'react';
import { useVideoUpload } from './use-video-upload';
import { formatFileSize } from '@/shared';
import { FileVideoIcon } from '@/components/icons';
import { Play, Pause } from 'lucide-react';
import styles from './video-upload.module.less';

interface VideoUploadProgressProps {
  state?: ReturnType<typeof useVideoUpload>['state'];
  handlePauseResume?: ReturnType<typeof useVideoUpload>['handlePauseResume'];
}

const VideoUploadProgress: React.FC<VideoUploadProgressProps> = (props) => {
  const fallbackHook = useVideoUpload();
  const state = props.state ?? fallbackHook.state;
  const handlePauseResume = props.handlePauseResume ?? fallbackHook.handlePauseResume;
  const { uploading, uploadProgress, uploadStatus, currentFile } = state;

  if (!uploading && uploadStatus !== 'completed') {
    return null;
  }

  const uploadedBytes = currentFile ? (currentFile.size * uploadProgress) / 100 : 0;

  return (
    <div className={styles.stepContent}>
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <div className={styles.progressFileIcon}>
            <FileVideoIcon size={20} />
          </div>
          <div className={styles.progressInfo}>
            <div className={styles.progressFileName}>{currentFile?.name}</div>
            <div className={styles.progressMeta}>
              {formatFileSize(uploadedBytes)} / {formatFileSize(currentFile?.size ?? 0)}
            </div>
          </div>
        </div>

        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${uploadProgress}%` }}
          />
        </div>

        <div className={styles.progressFooter}>
          <div className={styles.progressPercent}>{Math.round(uploadProgress)}%</div>
          <div className={styles.progressStatus}>
            {uploadStatus === 'completed' ? '处理中...' : uploadStatus === 'paused' ? '已暂停' : '上传中...'}
          </div>
        </div>
      </div>

      {uploadStatus !== 'completed' && (
        <div className={styles.videoActions}>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={handlePauseResume}
          >
            {uploadStatus === 'paused' ? (
              <>
                <Play size={16} />
                继续上传
              </>
            ) : (
              <>
                <Pause size={16} />
                暂停上传
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoUploadProgress;
