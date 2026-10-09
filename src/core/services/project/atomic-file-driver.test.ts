import { describe, it, expect, vi, beforeEach } from 'vitest';
import { atomicFileDriver } from './atomic-file-driver';

describe('AtomicProjectFileDriver', () => {
  beforeEach(() => {
    atomicFileDriver.invalidateCache('test_proj');
  });

  it('should write data atomically and populate memory cache', async () => {
    const writerMock = vi.fn().mockResolvedValue(undefined);
    const data = { id: 'test_proj', name: '测试工程' };

    const result = await atomicFileDriver.writeAtomic('test_proj', data, writerMock);
    expect(result).toBe(true);
    expect(writerMock).toHaveBeenCalledWith(data);

    const cached = atomicFileDriver.getMemoryCache<typeof data>('test_proj');
    expect(cached).toEqual(data);
  });

  it('should handle sequential queueing without race conditions', async () => {
    const sequence: number[] = [];
    const writer1 = vi.fn().mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 20));
      sequence.push(1);
    });
    const writer2 = vi.fn().mockImplementation(async () => {
      sequence.push(2);
    });

    const p1 = atomicFileDriver.writeAtomic('test_proj', { v: 1 }, writer1);
    const p2 = atomicFileDriver.writeAtomic('test_proj', { v: 2 }, writer2);

    await Promise.all([p1, p2]);
    expect(sequence).toEqual([1, 2]);
  });

  it('should invalidate cache properly', async () => {
    await atomicFileDriver.writeAtomic('test_proj', { a: 1 }, async () => {});
    expect(atomicFileDriver.getMemoryCache('test_proj')).toBeDefined();

    atomicFileDriver.invalidateCache('test_proj');
    expect(atomicFileDriver.getMemoryCache('test_proj')).toBeNull();
  });

  it('should return null for expired cache', async () => {
    await atomicFileDriver.writeAtomic('test_proj', { a: 1 }, async () => {});
    const cached = atomicFileDriver.getMemoryCache('test_proj', -1);
    expect(cached).toBeNull();
  });

  it('should throw if projectId is empty', async () => {
    await expect(atomicFileDriver.writeAtomic('', {}, async () => {})).rejects.toThrow();
  });
});
