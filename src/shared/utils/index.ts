/**
 * 通用工具函数（精简至实际使用的导出）
 */

import { AppError } from '@/shared/errors';
export * from './notify';
export * from './time';

// Time formatting & timestamps (used by timeline, video-player, etc.)
export {
  formatTime,
  formatDuration,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  clamp,
  formatTimecodeMs,
  MS_PER_SECOND,
} from './formatting';

// 项目指标解析
export { readNumberField, resolveProjectVideoPath, extractProjectMediaMetrics, pickPreferredSizeMb } from './project-metrics';

/**
 * 生成唯一 ID
 */
export function generateId(prefix?: string): string {
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * 延迟
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带指数退避的重试
 */
export async function retry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  if (attempts < 1) {
    throw new AppError('APP_RETRY_INVALID', 'retry: attempts must be >= 1', {
      userMessage: 'retry 调用参数错误',
    });
  }

  let lastError: Error | undefined;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < attempts - 1) {
        await delay(delayMs * Math.pow(2, i));
      }
    }
  }

  throw lastError ?? new Error('retry: failed without capturing an error');
}

/**
 * 并发映射：并行处理数组元素，限制同时运行的任务数
 */
export async function concurrentMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit = 8
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      let i: number;
      while ((i = index++) < items.length) {
        results[i] = await fn(items[i]);
      }
    })()
  );
  await Promise.all(workers);
  return results;
}
