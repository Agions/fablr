/**
 * 剧工 (Fablr) — 客户端版本更新状态管理 (Updater Store 增强版)
 * 支持静默后台轮询、忽略特定版本、国内加速镜像配置与持久化
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppUpdateInfo, UpdateCheckStatus, AutoCheckFrequency } from '@/types';
import { updaterService } from '@/core/services/updater/updater-service';
import { notify } from '@/shared';

export interface UpdaterState {
  status: UpdateCheckStatus;
  currentVersion: string;
  updateInfo: AppUpdateInfo | null;
  isModalOpen: boolean;
  hasUnreadUpdate: boolean;
  lastCheckedAt: string | null;

  // 用户偏好设置
  autoCheckFrequency: AutoCheckFrequency;
  customMirrorUrl: string;
  ignoredVersions: string[];

  // Actions
  checkForUpdates: (silent?: boolean) => Promise<boolean>;
  openUpdateModal: () => void;
  closeUpdateModal: () => void;
  markUpdateAsRead: () => void;
  ignoreCurrentVersion: () => void;
  setAutoCheckFrequency: (freq: AutoCheckFrequency) => void;
  setCustomMirrorUrl: (url: string) => void;
  initAutoCheck: () => void;
}

export const useUpdaterStore = create<UpdaterState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      currentVersion: '2.2.1',
      updateInfo: null,
      isModalOpen: false,
      hasUnreadUpdate: false,
      lastCheckedAt: null,

      autoCheckFrequency: 'launch',
      customMirrorUrl: 'https://ghproxy.net',
      ignoredVersions: [],

      checkForUpdates: async (silent = false) => {
        const { currentVersion, customMirrorUrl, ignoredVersions } = get();
        set({ status: 'checking' });

        if (!silent) {
          notify.loading('正在连接高速镜像检查最新版本...', 'update-check');
        }

        try {
          const { hasUpdate, updateInfo } = await updaterService.checkForUpdate(currentVersion, {
            mirrorPrefix: customMirrorUrl,
          });
          const now = new Date().toLocaleTimeString();

          if (hasUpdate && updateInfo) {
            const isIgnored = ignoredVersions.includes(updateInfo.version);
            
            // 如果是被用户忽略的版本且处于静默模式，则不弹窗不打扰
            if (isIgnored && silent) {
              set({
                status: 'available',
                updateInfo,
                lastCheckedAt: now,
              });
              return false;
            }

            set({
              status: 'available',
              updateInfo,
              isModalOpen: !isIgnored || !silent,
              hasUnreadUpdate: true,
              lastCheckedAt: now,
            });

            if (!silent) {
              notify.success(`发现新版本 v${updateInfo.version}！`, 'update-check');
            }
            return true;
          }

          set({
            status: 'not-available',
            updateInfo: null,
            lastCheckedAt: now,
          });

          if (!silent) {
            notify.success(`当前已是最新版本 (v${currentVersion})`, 'update-check');
          }
          return false;
        } catch {
          set({ status: 'error' });
          if (!silent) {
            notify.error(null, '检查更新失败，请稍后重试', 'update-check');
          }
          return false;
        }
      },

      openUpdateModal: () => set({ isModalOpen: true, hasUnreadUpdate: false }),
      closeUpdateModal: () => set({ isModalOpen: false }),
      markUpdateAsRead: () => set({ hasUnreadUpdate: false }),

      ignoreCurrentVersion: () => {
        const { updateInfo, ignoredVersions } = get();
        if (updateInfo) {
          set({
            ignoredVersions: Array.from(new Set([...ignoredVersions, updateInfo.version])),
            isModalOpen: false,
            hasUnreadUpdate: false,
          });
          notify.info(`已跳过 v${updateInfo.version} 的自动提醒`);
        }
      },

      setAutoCheckFrequency: freq => set({ autoCheckFrequency: freq }),
      setCustomMirrorUrl: url => set({ customMirrorUrl: url }),

      initAutoCheck: () => {
        const { autoCheckFrequency, checkForUpdates } = get();
        if (autoCheckFrequency === 'manual') return;

        // 延迟 2.5 秒触发，防止与应用启动首屏资源争抢
        setTimeout(() => {
          void checkForUpdates(true);
        }, 2500);
      },
    }),
    {
      name: 'fablr_updater_preferences',
      partialize: state => ({
        autoCheckFrequency: state.autoCheckFrequency,
        customMirrorUrl: state.customMirrorUrl,
        ignoredVersions: state.ignoredVersions,
      }),
    }
  )
);
