/**
 * 客户端版本检查与更新服务 (UpdaterService 增强版)
 *
 * 核心优化特性：
 * 1. 国内 GitHub API 自动镜像加速与备用源轮询降级；
 * 2. 智能识别宿主操作系统 (macOS / Windows / Linux)，精准匹配专属架构安装包资产；
 * 3. 语义化版本 SemVer 深度比对。
 */

import type { AppUpdateInfo, ReleaseAsset } from '@/types';
import { logger } from '@/shared/utils/logging';

export interface GitHubReleaseDto {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets?: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
  }>;
}

/**
 * 语义化版本比对
 */
export function compareSemVer(v1: string, v2: string): number {
  const cleanV1 = v1.replace(/^v/i, '').trim();
  const cleanV2 = v2.replace(/^v/i, '').trim();

  const parts1 = cleanV1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = cleanV2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

/**
 * 探测当前宿主操作系统
 */
export function detectHostPlatform(): 'macos' | 'windows' | 'linux' {
  if (typeof navigator === 'undefined') return 'macos';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac') || ua.includes('darwin')) return 'macos';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'macos';
}

/**
 * 匹配适合当前系统的发布资产
 */
export function findMatchingAsset(
  assets: ReleaseAsset[],
  platform: 'macos' | 'windows' | 'linux'
): ReleaseAsset | undefined {
  if (!assets || assets.length === 0) return undefined;

  if (platform === 'macos') {
    return (
      assets.find(a => a.name.endsWith('.dmg')) ||
      assets.find(a => a.name.endsWith('.app.tar.gz'))
    );
  }
  if (platform === 'windows') {
    return (
      assets.find(a => a.name.endsWith('.exe') || a.name.endsWith('.msi'))
    );
  }
  if (platform === 'linux') {
    return (
      assets.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.deb'))
    );
  }
  return assets[0];
}

export class UpdaterService {
  private static instance: UpdaterService;
  private readonly defaultRepo = 'agions/fablr';

  private constructor() {}

  public static getInstance(): UpdaterService {
    if (!UpdaterService.instance) {
      UpdaterService.instance = new UpdaterService();
    }
    return UpdaterService.instance;
  }

  /**
   * 构建多镜像源备用列表
   */
  private getApiUrls(repo: string, mirrorPrefix?: string): string[] {
    const urls = [
      `https://api.github.com/repos/${repo}/releases/latest`,
    ];
    if (mirrorPrefix && mirrorPrefix.trim()) {
      urls.unshift(`${mirrorPrefix.replace(/\/+$/, '')}/https://api.github.com/repos/${repo}/releases/latest`);
    }
    return urls;
  }

  /**
   * 检测是否有新版本发布（支持镜像加速与故障转移）
   */
  public async checkForUpdate(
    currentVersion: string,
    options?: { repo?: string; mirrorPrefix?: string; timeoutMs?: number }
  ): Promise<{ hasUpdate: boolean; updateInfo: AppUpdateInfo | null }> {
    const repo = options?.repo || this.defaultRepo;
    const urls = this.getApiUrls(repo, options?.mirrorPrefix);
    const timeoutMs = options?.timeoutMs || 8000;

    for (const url of urls) {
      try {
        logger.info(`[UpdaterService] 正在从 ${url} 检查最新版本... 当前版本: v${currentVersion}`);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(url, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!res.ok) {
          logger.warn(`[UpdaterService] 源 ${url} 返回非 200 状态码 (${res.status})，尝试下一备用源`);
          continue;
        }

        const release: GitHubReleaseDto = await res.json();
        const latestVersion = release.tag_name.replace(/^v/i, '').trim();

        // 比对版本
        if (compareSemVer(latestVersion, currentVersion) > 0) {
          const rawAssets: ReleaseAsset[] = (release.assets || []).map(a => {
            let platform: 'macos' | 'windows' | 'linux' | 'unknown' = 'unknown';
            if (a.name.endsWith('.dmg') || a.name.endsWith('.app.tar.gz')) platform = 'macos';
            else if (a.name.endsWith('.exe') || a.name.endsWith('.msi')) platform = 'windows';
            else if (a.name.endsWith('.AppImage') || a.name.endsWith('.deb')) platform = 'linux';

            return {
              name: a.name,
              browserDownloadUrl: a.browser_download_url,
              size: a.size,
              contentType: a.content_type,
              platform,
            };
          });

          const currentHostPlatform = detectHostPlatform();
          const matchedAsset = findMatchingAsset(rawAssets, currentHostPlatform);

          const updateInfo: AppUpdateInfo = {
            version: latestVersion,
            currentVersion,
            releaseDate: (release.published_at || '').slice(0, 10),
            releaseTitle: release.name || `剧工 (Fablr) v${latestVersion} 正式版`,
            releaseNotes: release.body || '新版本功能优化与缺陷修复，建议升级。',
            downloadUrl: matchedAsset ? matchedAsset.browserDownloadUrl : release.html_url,
            matchedAsset,
            assets: rawAssets,
            isMandatory: false,
          };

          logger.info(`[UpdaterService] 发现新版本: v${latestVersion}，专属资产: ${matchedAsset?.name || '默认发布页'}`);
          return { hasUpdate: true, updateInfo };
        }

        logger.info(`[UpdaterService] 当前已是最新版本 (v${currentVersion})`);
        return { hasUpdate: false, updateInfo: null };
      } catch (error) {
        logger.warn(`[UpdaterService] 请求源 ${url} 发生异常:`, error);
      }
    }

    logger.warn('[UpdaterService] 所有更新源均不可达，检查失败');
    return { hasUpdate: false, updateInfo: null };
  }

  /**
   * 打开下载页面或直接启动下载
   */
  public openDownloadPage(url: string, mirrorPrefix?: string): void {
    if (typeof window === 'undefined' || !url) return;
    let finalUrl = url;
    if (mirrorPrefix && mirrorPrefix.trim() && !url.startsWith(mirrorPrefix)) {
      finalUrl = `${mirrorPrefix.replace(/\/+$/, '')}/${url}`;
    }
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  }
}

export const updaterService = UpdaterService.getInstance();
