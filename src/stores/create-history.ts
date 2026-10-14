/**
 * createHistory — 泛型 undo/redo 历史记录模块
 *
 * 从 timelineStore 内联的 trackHistory（past/future/save/undo/redo/canUndo/canRedo）抽离，
 * 提供可复用的 history 容器。
 *
 * 用法：
 *   // 在 store actions 内部
 *   const hist = createHistory<TimelineTrack[]>({ maxSize: 19 });
 *
 *   // 修改前：
 *   hist.save(get().timelineTracks);
 *   set((s) => ({ timelineTracks: next }));
 *
 *   // 撤销：
 *   const prev = hist.undo(get().timelineTracks);
 *   if (prev !== undefined) set({ timelineTracks: prev });
 *
 * 设计要点：
 * - 纯内部状态，闭包内 past/future 数组（不污染 store state）
 * - 泛型 T 是被追踪的"快照"类型
 * - maxSize 滑动窗口避免内存膨胀
 * - 副作用由调用方控制（set/apply 显式调用）
 */
interface CreateHistoryOptions {
  /** 历史栈最大长度（默认 19） */
  maxSize?: number;
}

export function createHistory<T>(opts: CreateHistoryOptions = {}) {
  const past: T[] = [];
  const future: T[] = [];
  const maxSize = opts.maxSize ?? 19;

  const clone = (data: T): T => {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(data);
      } catch {
        // fallback
      }
    }
    return JSON.parse(JSON.stringify(data));
  };

  return {
    /** 把当前快照压入 past 栈（修改前调用） */
    save(snapshot: T) {
      past.push(clone(snapshot));
      if (past.length > maxSize) {
        past.splice(0, past.length - maxSize);
      }
      // 新操作清空 future 栈（标准 undo/redo 行为）
      future.length = 0;
    },

    /**
     * 撤销：从 past 弹出上一个快照 → 推入 future
     * @returns 撤销后的快照（调用方负责 set 到 state）；无历史返回 undefined
     */
    undo(currentSnapshot: T): T | undefined {
      if (past.length === 0) return undefined;
      const previous = past.pop()!;
      future.unshift(clone(currentSnapshot));
      return previous;
    },

    /**
     * 重做：从 future 取出下一个快照 → 推入 past
     * @returns 重做后的快照；无未来返回 undefined
     */
    redo(currentSnapshot: T): T | undefined {
      if (future.length === 0) return undefined;
      const next = future.shift()!;
      past.push(clone(currentSnapshot));
      return next;
    },

    canUndo(): boolean {
      return past.length > 0;
    },

    canRedo(): boolean {
      return future.length > 0;
    },

    /** 调试 / 测试用 */
    size(): { past: number; future: number } {
      return { past: past.length, future: future.length };
    },

    /** 重置（用于 store 测试的 setUp） */
    clear() {
      past.length = 0;
      future.length = 0;
    },
  };
}
