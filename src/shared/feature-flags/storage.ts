/**
 * Feature Flags — localStorage 读写层
 *
 * 职责：单一职责地管理 localStorage 的存取 + 序列化。
 * 不依赖 React，可在任意上下文（store初始化、工具函数）调用。
 *
 * 持久化 key：fablr-feature-flags（向后兼容读取 legacy: StoryFab-feature-flags）
 * 存储格式：JSON Record<string, boolean>
 */

import { DEFAULT_FLAGS, isFeatureFlagKey, type FeatureFlagKey } from './types';

// ─── 持久化 Key ──────────────────────────────────────────

export const STORAGE_KEY = 'fablr-feature-flags';
const LEGACY_STORAGE_KEY = 'StoryFab-feature-flags';

// ─── 序列化格式 ──────────────────────────────────────────

/**
 * 写入格式：仅保存 override（差异部分），不写入默认值。
 * 读取时与 DEFAULT_FLAGS 合并。
 */
export type StoredFlags = Partial<Record<FeatureFlagKey, boolean>>;

/**
 * 完整合并后的运行时 view（供 UI 渲染使用）。
 */
export type ResolvedFlags = Record<FeatureFlagKey, boolean>;

// ─── 读写 ───────────────────────────────────────────────

/**
 * 读取并合并 flag。
 * 优先使用 localStorage 中的 override，缺失键回退到 DEFAULT_FLAGS。
 *
 * @returns 合并后的完整 ResolvedFlags
 */
export function readResolvedFlags(): ResolvedFlags {
  const stored = readStoredFlags();
  return { ...DEFAULT_FLAGS, ...stored };
}

/**
 * 仅读取 localStorage 中存储的 override（不含默认）。
 * 优先读取新 key，缺失时从旧 key 迁移并自动清理。
 * 忽略非法 key 和非 boolean 值（防御脏数据）。
 */
export function readStoredFlags(): StoredFlags {
  if (typeof localStorage === 'undefined') return {};
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      raw = legacyRaw;
      try {
        localStorage.setItem(STORAGE_KEY, legacyRaw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: StoredFlags = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isFeatureFlagKey(key) && typeof value === 'boolean') {
        result[key] = value;
      }
    }
    return result;
  } catch {
    // 静默容错：JSON 解析失败 → 视作无 override
    return {};
  }
}

/**
 * 将 override 写入 localStorage。
 * 传入 null/undefined 会删除该 key 的 override（恢复默认）。
 *
 * @param key flag key
 * @param value true 开启 / false 关闭 / null 清除 override
 */
export function writeFlag(key: FeatureFlagKey, value: boolean | null): void {
  if (typeof localStorage === 'undefined') return;
  const current = readStoredFlags();
  if (value === null || value === DEFAULT_FLAGS[key]) {
    delete current[key];
  } else {
    current[key] = value;
  }
  if (Object.keys(current).length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
}

/**
 * 清除所有 override（全部 flag 回到默认）。
 * 留给"还原默认设置"按钮使用。
 */
export function clearAllFlags(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
