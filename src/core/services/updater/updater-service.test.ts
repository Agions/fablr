import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compareSemVer,
  detectHostPlatform,
  findMatchingAsset,
  updaterService,
} from './updater-service';
import type { ReleaseAsset } from '@/types';

describe('UpdaterService Enhanced Suite', () => {
  describe('compareSemVer', () => {
    it('should correctly compare semver versions', () => {
      expect(compareSemVer('2.3.0', '2.2.0')).toBe(1);
      expect(compareSemVer('2.2.0', '2.3.0')).toBe(-1);
      expect(compareSemVer('2.2.0', '2.2.0')).toBe(0);
      expect(compareSemVer('v2.2.1', '2.2.0')).toBe(1);
      expect(compareSemVer('3.0.0', '2.9.9')).toBe(1);
      expect(compareSemVer('2.2.0', '2.2.0.1')).toBe(-1);
    });
  });

  describe('detectHostPlatform & findMatchingAsset', () => {
    it('should find matching asset for macOS', () => {
      const assets: ReleaseAsset[] = [
        { name: 'fablr_setup.exe', browserDownloadUrl: 'http://exe', size: 100, contentType: 'app/exe' },
        { name: 'Fablr_mac_arm64.dmg', browserDownloadUrl: 'http://dmg', size: 100, contentType: 'app/dmg' },
      ];
      const match = findMatchingAsset(assets, 'macos');
      expect(match?.name).toBe('Fablr_mac_arm64.dmg');
    });

  it('should find matching asset for Windows', () => {
      const assets: ReleaseAsset[] = [
        { name: 'fablr_setup.exe', browserDownloadUrl: 'http://exe', size: 100, contentType: 'app/exe' },
        { name: 'Fablr_mac_arm64.dmg', browserDownloadUrl: 'http://dmg', size: 100, contentType: 'app/dmg' },
      ];
      const match = findMatchingAsset(assets, 'windows');
      expect(match?.name).toBe('fablr_setup.exe');
    });

    it('should detect host platform safely', () => {
      const platform = detectHostPlatform();
      expect(['macos', 'windows', 'linux']).toContain(platform);
    });
  });

  describe('checkForUpdate', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should identify when an update is available with matched asset', async () => {
      const mockRelease = {
        tag_name: 'v2.3.0',
        name: 'Fablr v2.3.0 剧作工坊重大升级',
        body: '- 优化 5 轨剪辑时间轴\n- 增强多 Agent 剧本研磨',
        published_at: '2026-08-30T10:00:00Z',
        html_url: 'https://github.com/agions/fablr/releases/tag/v2.3.0',
        assets: [
          {
            name: 'Fablr_2.3.0_x64.dmg',
            browser_download_url: 'https://github.com/agions/fablr/releases/download/v2.3.0/Fablr_2.3.0_x64.dmg',
            size: 45000000,
            content_type: 'application/octet-stream',
          },
          {
            name: 'Fablr_2.3.0_x64_en-US.msi',
            browser_download_url: 'https://github.com/agions/fablr/releases/download/v2.3.0/Fablr_2.3.0_x64.msi',
            size: 55000000,
            content_type: 'application/octet-stream',
          },
          {
            name: 'Fablr_2.3.0_amd64.AppImage',
            browser_download_url: 'https://github.com/agions/fablr/releases/download/v2.3.0/Fablr_2.3.0.AppImage',
            size: 65000000,
            content_type: 'application/octet-stream',
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      } as Response);

      const res = await updaterService.checkForUpdate('2.2.0', {
        mirrorPrefix: 'https://ghproxy.net',
      });
      expect(res.hasUpdate).toBe(true);
      expect(res.updateInfo?.version).toBe('2.3.0');
      expect(res.updateInfo?.matchedAsset).toBeDefined();
    });

    it('should handle mirror failure and fallback to next url', async () => {
      const mockRelease = {
        tag_name: 'v2.3.0',
        name: 'Fablr v2.3.0',
        body: 'Notes',
        published_at: '2026-08-30T10:00:00Z',
        html_url: 'https://github.com/agions/fablr/releases/tag/v2.3.0',
      };

      // 第一次失败，第二次成功
      globalThis.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Mirror 1 timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRelease,
        } as Response);

      const res = await updaterService.checkForUpdate('2.2.0', {
        mirrorPrefix: 'https://ghproxy.net',
      });
      expect(res.hasUpdate).toBe(true);
      expect(res.updateInfo?.version).toBe('2.3.0');
    });
  });

  describe('openDownloadPage', () => {
    it('should open mirror download url properly', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      updaterService.openDownloadPage('https://github.com/agions/fablr/file.dmg', 'https://ghproxy.net');
      expect(openSpy).toHaveBeenCalledWith(
        'https://ghproxy.net/https://github.com/agions/fablr/file.dmg',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });
});
