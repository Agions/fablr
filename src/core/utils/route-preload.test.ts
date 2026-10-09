/**
 * route-preload — 单元测试（onceCache + runOnce）
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  preloadProjectsPage,
  preloadProjectEditPage,
  preloadProjectDetailPage,
  preloadWorkspacePage,
  preloadAIVideoEditorPage,
  preloadSettingsPage,
} from './route-preload';

// 静默动态 import 解析过程中的 console.error 噪音
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

describe('route preload functions', () => {
  it('each function returns a Promise', () => {
    const promises = [
      preloadProjectsPage(),
      preloadProjectEditPage(),
      preloadProjectDetailPage(),
      preloadWorkspacePage(),
      preloadAIVideoEditorPage(),
      preloadSettingsPage(),
    ];
    promises.forEach(p => expect(p).toBeInstanceOf(Promise));
    // 清空未处理 rejection
    void Promise.allSettled(promises);
  });

  it('deduplicates concurrent calls to the same key (returns same Promise)', async () => {
    // 不同 key 以避免之前测试污染缓存
    const p1 = preloadProjectDetailPage();
    const p2 = preloadProjectDetailPage();
    // 后续命中缓存返回同一 Promise
    expect(p2).toBe(p1);
    await p1.catch(() => {});
  });

  it('deduplicates calls even when first has resolved', async () => {
    const first = preloadSettingsPage();
    await first.catch(() => {});
    const second = preloadSettingsPage();
    expect(second).toBe(first);
  });

  it('different keys have different cache entries', async () => {
    const a = preloadProjectsPage();
    const b = preloadProjectEditPage();
    expect(a).not.toBe(b);
    await Promise.allSettled([a, b]);
  });
});

describe('loader promise shape', () => {
  it('returns thenable (then/catch/finally)', () => {
    const p = preloadProjectsPage();
    expect(typeof p.then).toBe('function');
    expect(typeof p.catch).toBe('function');
    expect(typeof p.finally).toBe('function');
  });

  it('does not throw synchronously', () => {
    expect(() => {
      void preloadAIVideoEditorPage();
    }).not.toThrow();
  });
});
