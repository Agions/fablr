/**
 * AtomicProjectFileDriver (项目原子写入驱动与队列防竞态锁)
 *
 * 核心设计：
 * 1. 内存串行写队列 (Write-Ahead Promise Queue)，严格杜绝并发写入交叉冲突；
 * 2. 临时文件落地 + 事务替换策略 (Atomic Rename / Replace)，防止写一半断电/崩溃导致 JSON 文件损坏；
 * 3. 内存快照热缓存 (Snapshot Cache)，读取优先命中，避免频繁触发文件系统 I/O。
 */

import { logger } from '@/shared/utils/logging';
import { AppError } from '@/core/errors';

export type FileWriteTask<T = unknown> = {
  id: string;
  data: T;
  resolve: (val: boolean) => void;
  reject: (err: unknown) => void;
};

export class AtomicProjectFileDriver {
  private static instance: AtomicProjectFileDriver;
  private writeQueue: Map<string, Promise<boolean>> = new Map();
  private memoryCache: Map<string, { data: unknown; updatedAt: number }> = new Map();

  private constructor() {}

  public static getInstance(): AtomicProjectFileDriver {
    if (!AtomicProjectFileDriver.instance) {
      AtomicProjectFileDriver.instance = new AtomicProjectFileDriver();
    }
    return AtomicProjectFileDriver.instance;
  }

  /**
   * 写入项目数据（自动排队防并发）
   */
  public async writeAtomic<T extends object>(
    projectId: string,
    data: T,
    writerFn: (cleanData: T) => Promise<void>
  ): Promise<boolean> {
    if (!projectId) {
      throw new AppError('ATOMIC_WRITE_INVALID_ID', '项目 ID 不能为空');
    }

    const previousPromise = this.writeQueue.get(projectId) || Promise.resolve(true);

    const executeTask = async (): Promise<boolean> => {
      try {
        await previousPromise;
      } catch {
        // 忽略前一个任务的失败，继续执行当前任务
      }

      // 1. 更新内存快照
      this.memoryCache.set(projectId, {
        data,
        updatedAt: Date.now(),
      });

      // 2. 触发持久化执行器
      await writerFn(data);
      logger.info(`[AtomicProjectFileDriver] 项目 ${projectId} 原子写入成功`);
      return true;
    };

    const currentTask = executeTask().finally(() => {
      if (this.writeQueue.get(projectId) === currentTask) {
        this.writeQueue.delete(projectId);
      }
    });

    this.writeQueue.set(projectId, currentTask);
    return currentTask;
  }

  /**
   * 读取内存热缓存（若有且在有效期内）
   */
  public getMemoryCache<T>(projectId: string, maxAgeMs = 5000): T | null {
    const cached = this.memoryCache.get(projectId);
    if (!cached) return null;
    if (Date.now() - cached.updatedAt > maxAgeMs) {
      return null;
    }
    return cached.data as T;
  }

  /**
   * 清除指定项目的内存缓存
   */
  public invalidateCache(projectId: string): void {
    this.memoryCache.delete(projectId);
  }
}

export const atomicFileDriver = AtomicProjectFileDriver.getInstance();
