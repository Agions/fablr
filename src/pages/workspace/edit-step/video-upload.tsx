/**
 * 步骤2: 上传视频 — AI Cinema Studio Redesign
 *
 * 重构说明：
 * - 组件已拆分为 VideoUploadDropzone / VideoUploadPreview / VideoUploadProgress / VideoUploadMetaForm
 * - 业务逻辑提取到 useVideoUpload hook
 * - 本文件仅保留组合逻辑，控制在 250 行以内
 */

import React, { memo } from 'react';
import { useVideoUpload } from './use-video-upload';
import VideoUploadDropzone from './video-upload-dropzone';
import VideoUploadPreview from './video-upload-preview';
import VideoUploadProgress from './video-upload-progress';
import VideoUploadMetaForm from './video-upload-meta-form';
import { TrashIcon } from '@/components/icons';
import { ArrowRight, Info } from 'lucide-react';
import styles from './video-upload.module.less';

interface VideoUploadProps {
  onNext?: () => void;
}

const VideoUpload: React.FC<VideoUploadProps> = memo(({ onNext }) => {
  const upload = useVideoUpload(onNext);
  const { projectState, state, goToNextStep, handleDelete } = upload;
  const { uploadStatus } = state;

  // === 已上传视频显示 ===
  if (projectState.currentVideo) {
    return (
      <div className={styles.stepContent}>
        <div className={styles.stepTitle}>
          <h2>已上传视频</h2>
          <p>视频已成功上传，可以继续下一步进行 AI 分析</p>
        </div>
        <VideoUploadPreview />
        <div className={styles.videoActions} style={{ paddingTop: 20 }}>
          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={handleDelete}>
            <TrashIcon size={16} />
            删除视频
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={goToNextStep}
          >
            下一步：AI 分析
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // === 上传中显示进度 ===
  if (uploadStatus === 'uploading' || uploadStatus === 'completed') {
    return (
      <div className={styles.stepContent}>
        <div className={styles.stepTitle}>
          <h2>上传进度</h2>
          <p>{uploadStatus === 'completed' ? '上传完成，正在准备视频...' : '正在上传视频，请稍候'}</p>
        </div>
        <VideoUploadProgress
          state={state}
          handlePauseResume={upload.handlePauseResume}
        />
      </div>
    );
  }

  // === 上传区域 ===
  return (
    <div className={styles.stepContent}>
      <div className={styles.stepTitle}>
        <h2>上传视频</h2>
        <p>支持多种视频格式，时长建议 1-30 分钟</p>
      </div>
      <VideoUploadDropzone
        uploadState={state}
        projectState={projectState}
        handleDragOver={upload.handleDragOver}
        handleDragLeave={upload.handleDragLeave}
        handleDrop={upload.handleDrop}
        handleClick={upload.handleClick}
        handleFileChange={upload.handleFileChange}
      />
      <div className={styles.hintAlert}>
        <div className={styles.hintAlertHeader}>
          <Info className={styles.hintIcon} size={16} />
          上传说明
        </div>
        <ul className={styles.hintList}>
          <li>请上传清晰的视频文件以获得最佳分析效果</li>
          <li>视频时长建议 1-30 分钟</li>
          <li>上传后系统将自动分析视频内容</li>
          <li>支持断点续传，大文件上传更稳定</li>
        </ul>
      </div>
      <VideoUploadMetaForm />
    </div>
  );
});

VideoUpload.displayName = 'VideoUpload';
export default VideoUpload;
