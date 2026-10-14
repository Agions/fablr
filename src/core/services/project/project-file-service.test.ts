/**
 * Project File Service — 单元测试
 *
 * 覆盖：
 * - saveProjectToFile: 成功保存 (SQLite + JSON) / apiKey 清除 / 序列化空 / 无效 ID / 备份路径
 * - loadProjectWithRetry: SQLite 优先 / 文件兜底 / 重试指数退避 / 全部失败
 * - listProjects: SQLite 优先 / 文件扫描兜底 / 异常转换
 * - deleteProject: 成功 (SQLite + 文件删除) / 失败 / 空 ID
 * - PROJECTS_CHANGED_EVENT 事件触发
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSqliteProject = {
  save: vi.fn(),
  load: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(),
};

vi.mock('@/core/tauri/methods/project', () => ({
  project: {
    save: (...args: unknown[]) => mockSqliteProject.save(...args),
    load: (...args: unknown[]) => mockSqliteProject.load(...args),
    list: (...args: unknown[]) => mockSqliteProject.list(...args),
    delete: (...args: unknown[]) => mockSqliteProject.delete(...args),
    create: (...args: unknown[]) => mockSqliteProject.create(...args),
  },
}));

const mockFs = {
  exists: vi.fn(),
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
};

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: (...args: unknown[]) => mockFs.exists(...args),
  mkdir: (...args: unknown[]) => mockFs.mkdir(...args),
  readTextFile: (...args: unknown[]) => mockFs.readTextFile(...args),
  writeTextFile: (...args: unknown[]) => mockFs.writeTextFile(...args),
  readDir: (...args: unknown[]) => mockFs.readDir(...args),
  remove: (...args: unknown[]) => mockFs.remove(...args),
  BaseDirectory: { AppData: 1, AppConfig: 2 },
}));

const mockGetConfigDir = vi.fn();
vi.mock('@/core/utils/config-dir', () => ({
  getConfigDir: () => mockGetConfigDir(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  PROJECTS_CHANGED_EVENT,
  saveProjectToFile,
  loadProjectWithRetry,
  listProjects,
  deleteProject,
} from './project-file-service';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const validProjectId = 'fablr-test-1234';
const sampleProject = {
  id: validProjectId,
  name: '测试项目',
  description: 'desc',
  status: 'draft',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const events: Event[] = [];
let installedHandler: EventListener | null = null;

beforeEach(() => {
  vi.resetAllMocks();
  events.length = 0;
  installedHandler = e => {
    events.push(e);
  };
  window.addEventListener(PROJECTS_CHANGED_EVENT, installedHandler);
  mockGetConfigDir.mockResolvedValue('/tmp/config/');

  // 默认：文件系统操作正常
  mockFs.exists.mockResolvedValue(true);
  mockFs.mkdir.mockResolvedValue(undefined);
  mockFs.writeTextFile.mockResolvedValue(undefined);
  mockFs.readDir.mockResolvedValue([]);
  mockFs.remove.mockResolvedValue(undefined);

  // 默认：SQLite 正常
  mockSqliteProject.save.mockResolvedValue(undefined);
  mockSqliteProject.load.mockResolvedValue(null);
  mockSqliteProject.list.mockResolvedValue([]);
  mockSqliteProject.delete.mockResolvedValue(undefined);
});

afterEach(() => {
  if (installedHandler) {
    window.removeEventListener(PROJECTS_CHANGED_EVENT, installedHandler);
    installedHandler = null;
  }
});

// ── saveProjectToFile ─────────────────────────────────────────────────────────

describe('saveProjectToFile', () => {
  it('writes project via SQLite and writeTextFile, then emits event', async () => {
    await saveProjectToFile(validProjectId, sampleProject);

    expect(mockSqliteProject.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: validProjectId,
        name: '测试项目',
      })
    );
    expect(mockFs.writeTextFile).toHaveBeenCalledWith(
      `fablr/${validProjectId}.json`,
      expect.stringContaining('"id": ' + JSON.stringify(validProjectId)),
      expect.objectContaining({ baseDir: 1 })
    );
    expect(events.length).toBe(1);
  });

  it('strips apiKey from aiModel before persisting', async () => {
    const projectWithKey = {
      ...sampleProject,
      aiModel: { apiKey: 'secret-key', model: 'gpt-4' },
    };

    await saveProjectToFile(validProjectId, projectWithKey);

    const serialized = mockFs.writeTextFile.mock.calls[0][1] as string;
    expect(serialized).not.toContain('secret-key');
    expect(serialized).toContain('"model": "gpt-4"');
  });

  it('throws AppError on empty project ID', async () => {
    await expect(saveProjectToFile('', sampleProject)).rejects.toThrow(/无效的项目数据/);
    expect(mockFs.writeTextFile).not.toHaveBeenCalled();
  });

  it('uses backup path when primary writeTextFile fails', async () => {
    mockFs.writeTextFile
      .mockRejectedValueOnce(new Error('primary fail'))
      .mockResolvedValueOnce(undefined); // backup path succeeds

    await saveProjectToFile(validProjectId, sampleProject);

    expect(mockFs.writeTextFile).toHaveBeenCalledTimes(2);
    expect(mockFs.writeTextFile.mock.calls[1][0]).toContain(validProjectId);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('still writes to file if SQLite save fails', async () => {
    mockSqliteProject.save.mockRejectedValueOnce(new Error('sqlite error'));

    await saveProjectToFile(validProjectId, sampleProject);

    expect(mockFs.writeTextFile).toHaveBeenCalled();
    expect(events.length).toBe(1);
  });
});

// ── loadProjectWithRetry ──────────────────────────────────────────────────────

describe('loadProjectWithRetry', () => {
  it('returns data directly from SQLite when available', async () => {
    const sqliteRecord = {
      id: validProjectId,
      name: 'SQLite项目',
      videoPath: '/path/video.mp4',
      subtitlePath: null,
      intent: {},
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      latestJob: { phase: 'rendering' },
    };
    mockSqliteProject.load.mockResolvedValue(sqliteRecord);

    const result = await loadProjectWithRetry(validProjectId);

    expect(result.id).toBe(validProjectId);
    expect(result.name).toBe('SQLite项目');
    expect(result.status).toBe('completed');
    expect(mockSqliteProject.load).toHaveBeenCalledWith(validProjectId);
  });

  it('falls back to JSON file when SQLite load returns null', async () => {
    mockSqliteProject.load.mockResolvedValue(null);
    const fileData = { id: validProjectId, name: 'File项目' };
    mockFs.exists.mockResolvedValue(true);
    mockFs.readTextFile.mockResolvedValue(JSON.stringify(fileData));

    const result = await loadProjectWithRetry(validProjectId);

    expect(result).toEqual(fileData);
    expect(mockFs.readTextFile).toHaveBeenCalledWith(
      `fablr/${validProjectId}.json`,
      expect.objectContaining({ baseDir: 1 })
    );
  });

  it('retries with exponential backoff on failure', async () => {
    mockSqliteProject.load.mockRejectedValue(new Error('db error'));
    mockFs.exists.mockResolvedValue(false);

    await expect(
      loadProjectWithRetry(validProjectId, { retries: 2, retryDelayMs: 10 })
    ).rejects.toThrow();

    expect(mockSqliteProject.load).toHaveBeenCalledTimes(3);
  });

  it('throws lastError after exhausting retries', async () => {
    mockSqliteProject.load.mockRejectedValue(new Error('permanent failure'));
    mockFs.exists.mockResolvedValue(false);

    await expect(loadProjectWithRetry(validProjectId, { retries: 1, retryDelayMs: 5 })).rejects.toThrow();
  });
});

// ── listProjects ──────────────────────────────────────────────────────────────

describe('listProjects', () => {
  it('returns list from SQLite when available', async () => {
    const sqliteList = [
      { id: 'p1', name: '项目 1', updatedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', videoPath: 'v1.mp4' },
      { id: 'p2', name: '项目 2', updatedAt: '2026-01-02T00:00:00Z', createdAt: '2026-01-02T00:00:00Z', videoPath: 'v2.mp4' },
    ];
    mockSqliteProject.list.mockResolvedValue(sqliteList);

    const projects = await listProjects();

    expect(projects).toHaveLength(2);
    expect(projects[0].id).toBe('p1');
    expect(projects[1].name).toBe('项目 2');
    expect(mockFs.readDir).not.toHaveBeenCalled();
  });

  it('falls back to file scanning when SQLite returns empty list', async () => {
    mockSqliteProject.list.mockResolvedValue([]);
    mockFs.readDir.mockResolvedValue([
      { isFile: true, name: 'p1.json' },
      { isFile: true, name: 'p2.json' },
    ]);
    mockFs.exists.mockResolvedValue(true);
    mockFs.readTextFile
      .mockResolvedValueOnce(JSON.stringify({ id: 'p1', name: '项目 1' }))
      .mockResolvedValueOnce(JSON.stringify({ id: 'p2', name: '项目 2' }));

    const projects = await listProjects();

    expect(mockFs.readDir).toHaveBeenCalledWith('fablr', expect.objectContaining({ baseDir: 1 }));
    expect(projects).toHaveLength(2);
  });

  it('filters out non-record and invalid files during file scan', async () => {
    mockSqliteProject.list.mockResolvedValue([]);
    mockFs.readDir.mockResolvedValue([
      { isFile: true, name: 'corrupted.json' },
      { isFile: true, name: 'good.json' },
    ]);
    mockFs.exists.mockResolvedValue(true);
    mockFs.readTextFile
      .mockResolvedValueOnce('null')
      .mockResolvedValueOnce(JSON.stringify({ id: 'good', name: '好项目' }));

    const projects = await listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe('good');
  });

  it('returns empty array when scanning directory has no json files', async () => {
    mockSqliteProject.list.mockResolvedValue([]);
    mockFs.readDir.mockResolvedValue([
      { isFile: true, name: 'readme.txt' },
      { isFile: false, name: 'subfolder' },
    ]);

    const projects = await listProjects();

    expect(projects).toEqual([]);
  });

  it('rethrows when ensureAppDataDir fails with unhandled error', async () => {
    mockSqliteProject.list.mockRejectedValue(new Error('sqlite fail'));
    mockFs.exists.mockRejectedValue(new Error('fs permission denied'));

    await expect(listProjects()).rejects.toThrow();
  });
});

// ── deleteProject ─────────────────────────────────────────────────────────────

describe('deleteProject', () => {
  it('deletes via SQLite and file remove, then emits event', async () => {
    mockSqliteProject.delete.mockResolvedValue(undefined);
    mockFs.remove.mockResolvedValue(undefined);

    const result = await deleteProject(validProjectId);

    expect(result).toBe(true);
    expect(mockSqliteProject.delete).toHaveBeenCalledWith(validProjectId);
    expect(mockFs.remove).toHaveBeenCalledWith(
      `fablr/${validProjectId}.json`,
      expect.objectContaining({ baseDir: 1 })
    );
    expect(events.length).toBe(1);
  });

  it('returns false on empty ID without calling SQLite or remove', async () => {
    const result = await deleteProject('');

    expect(result).toBe(false);
    expect(mockSqliteProject.delete).not.toHaveBeenCalled();
    expect(mockFs.remove).not.toHaveBeenCalled();
    expect(events.length).toBe(0);
  });

  it('still succeeds deleting file even if SQLite delete throws', async () => {
    mockSqliteProject.delete.mockRejectedValue(new Error('sqlite error'));
    mockFs.remove.mockResolvedValue(undefined);

    const result = await deleteProject(validProjectId);

    expect(result).toBe(true);
    expect(mockFs.remove).toHaveBeenCalledWith(
      `fablr/${validProjectId}.json`,
      expect.objectContaining({ baseDir: 1 })
    );
    expect(events.length).toBe(1);
  });
});

// ── PROJECTS_CHANGED_EVENT 边界 ───────────────────────────────────────────────

describe('PROJECTS_CHANGED_EVENT', () => {
  it('constant is the documented event name', () => {
    expect(PROJECTS_CHANGED_EVENT).toBe('Fablr:projects:changed');
  });
});
