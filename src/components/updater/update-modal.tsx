/**
 * 剧工 (Fablr) — 客户端版本升级弹窗组件 (UpdateModal 增强版)
 * 黑曜石工业风设计，精准系统安装包识别、更新日志、跳过版本与镜像下载
 */

import React from 'react';
import {
  Sparkles,
  Download,
  X,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Layers,
  Laptop,
  EyeOff,
} from 'lucide-react';
import { useUpdaterStore } from '@/stores/updater-store';
import { updaterService, detectHostPlatform } from '@/core/services/updater/updater-service';
import { formatFileSize } from '@/shared';
import styles from './update-modal.module.less';

export const UpdateModal: React.FC = () => {
  const {
    isModalOpen,
    updateInfo,
    currentVersion,
    customMirrorUrl,
    closeUpdateModal,
    ignoreCurrentVersion,
  } = useUpdaterStore();

  if (!isModalOpen || !updateInfo) return null;

  const currentPlatform = detectHostPlatform();
  const matchedAsset = updateInfo.matchedAsset;

  const handleDownload = () => {
    if (updateInfo.downloadUrl) {
      updaterService.openDownloadPage(updateInfo.downloadUrl, customMirrorUrl);
    }
  };

  const getPlatformLabel = () => {
    if (currentPlatform === 'macos') return 'macOS 架构 (Apple Silicon / Intel)';
    if (currentPlatform === 'windows') return 'Windows x64 / ARM64';
    return 'Linux (AppImage / DEB)';
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalDialog}>
        {/* 顶部极光背景装饰 */}
        <div className={styles.auroraBg} />

        {/* 弹窗头部 */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.sparkleIconBox}>
              <Sparkles size={22} />
            </div>
            <div>
              <div className={styles.titleRow}>
                <span className={styles.modalTitle}>发现剧工作坊新版本</span>
                <span className={styles.versionBadge}>
                  v{updateInfo.version}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span>当前版本: v{currentVersion}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> 发布于 {updateInfo.releaseDate || '最近'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={closeUpdateModal}
            className={styles.closeBtn}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* 专属适配安装包提示卡 */}
        <div className={styles.platformBannerWrap}>
          <div className={styles.platformBanner}>
            <div className={styles.platformLeft}>
              <Laptop size={16} className={styles.sparkleIconBox} />
              <div>
                <div className={styles.platformName}>
                  已适配当前设备：{getPlatformLabel()}
                </div>
                <div className={styles.platformAsset}>
                  {matchedAsset?.name || '官方安装包分发源'}
                  {matchedAsset?.size ? ` (${formatFileSize(matchedAsset.size)})` : ''}
                </div>
              </div>
            </div>
            <span className={styles.platformTag}>
              高速下载通道
            </span>
          </div>
        </div>

        {/* 更新日志主体 */}
        <div className={styles.notesBody}>
          <div className={styles.notesHeader}>
            <Layers size={13} />
            <span>更新日志与新功能 (Release Notes)</span>
          </div>

          <div className={styles.notesCard}>
            <div className={styles.releaseTitle}>
              {updateInfo.releaseTitle}
            </div>
            <div className={styles.notesContent}>
              {updateInfo.releaseNotes}
            </div>
          </div>

          {/* 核心亮点标签 */}
          <div className={styles.highlightGrid}>
            <div className={styles.highlightItem}>
              <CheckCircle2 size={13} className={styles.successIcon} />
              <span>多 Agent 剧本算法与剪辑稳定性</span>
            </div>
            <div className={styles.highlightItem}>
              <CheckCircle2 size={13} className={styles.successIcon} />
              <span>5 轨硬件加速与消重矩阵优化</span>
            </div>
          </div>
        </div>

        {/* 弹窗底部操作条 */}
        <div className={styles.modalFooter}>
          <button
            onClick={ignoreCurrentVersion}
            className={styles.skipBtn}
          >
            <EyeOff size={12} />
            <span>跳过此版本</span>
          </button>

          <div className={styles.footerActions}>
            <button
              onClick={closeUpdateModal}
              className={styles.laterBtn}
            >
              稍后提醒
            </button>
            <button
              onClick={handleDownload}
              className={styles.downloadBtn}
            >
              <Download size={13} />
              <span>立即下载并安装</span>
              <ExternalLink size={11} className="opacity-70 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
