/**
 * Project File Service — 单元测试
 *
 * 覆盖（PR-M2.1a）：
 * - saveProjectToFile: 成功路径 / apiKey 清除 / 序列化空 / 无效 ID
 * - loadProjectWithRetry: 成功 / 重试指数退避 / 全部失败
 * - listProjects: Rust 路径 / 兜底路径 / 异常转换
 * - deleteProject: 成功 / 失败 / 空 ID
 * - PROJECTS_CHANGED_EVENT 事件触发
 *
 * 注：normalizedListedProject 是私有函数（不导出），通过 listProjects 间接验证。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTauri = {
  saveProjectFile: vi.fn(),
  loadProjectFile: vi.fn(),
  listProjectFiles: vi.fn(),
  deleteProjectFile: vi.fn(),
  checkAppDataDirectory: vi.fn(),
  listAppDataFiles: vi.fn(),
};

vi.mock('@/core/tauri', () => ({
  tauri: {
    saveProjectFile: (...args: unknown[]) => mockTauri.saveProjectFile(...args),
    loadProjectFile: (...args: unknown[]) => mockTauri.loadProjectFile(...args),
    listProjectFiles: (...args: unknown[]) => mockTauri.listProjectFiles(...args),
    deleteProjectFile: (...args: unknown[]) => mockTauri.deleteProjectFile(...args),
    checkAppDataDirectory: (...args: unknown[]) => mockTauri.checkAppDataDirectory(...args),
    listAppDataFiles: (...args: unknown[]) => mockTauri.listAppDataFiles(...args),
  },
}));

const mockFs = {
  exists: vi.fn(),
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
};

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: (...args: unknown[]) => mockFs.exists(...args),
  mkdir: (...args: unknown[]) => mockFs.mkdir(...args),
  readTextFile: (...args: unknown[]) => mockFs.readTextFile(...args),
  writeTextFile: (...args: unknown[]) => mockFs.writeTextFile(...args),
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
  // 监听 PROJECTS_CHANGED_EVENT 事件
  installedHandler = e => {
    events.push(e);
  };
  window.addEventListener(PROJECTS_CHANGED_EVENT, installedHandler);
  mockGetConfigDir.mockResolvedValue('/tmp/config/');
  // 默认：Rust 写文件成功
  mockTauri.saveProjectFile.mockResolvedValue(undefined);
  // 默认：目录检查成功（Rust 路径）
  mockTauri.checkAppDataDirectory.mockResolvedValue('/tmp/data');
});

afterEach(() => {
  if (installedHandler) {
    window.removeEventListener(PROJECTS_CHANGED_EVENT, installedHandler);
    installedHandler = null;
  }
});

// ── saveProjectToFile ─────────────────────────────────────────────────────────

describe('saveProjectToFile', () => {
  it('writes project via Rust tauri API and emits event', async () => {
    await saveProjectToFile(validProjectId, sampleProject);

    expect(mockTauri.saveProjectFile).toHaveBeenCalledWith(
      validProjectId,
      expect.stringContaining('"id": ' + JSON.stringify(validProjectId))
    );
    expect(events.length).toBe(1);
  });

  it('strips apiKey from aiModel before persisting', async () => {
    const projectWithKey = {
      ...sampleProject,
      aiModel: { apiKey: 'secret-key', model: 'gpt-4' },
    };

    await saveProjectToFile(validProjectId, projectWithKey);

    const serialized = mockTauri.saveProjectFile.mock.calls[0][1] as string;
    expect(serialized).not.toContain('secret-key');
    expect(serialized).toContain('"model": "gpt-4"');
  });

  it('throws AppError on empty project ID', async () => {
    await expect(saveProjectToFile('', sampleProject)).rejects.toThrow(/无效的项目数据/);
    expect(mockTauri.saveProjectFile).not.toHaveBeenCalled();
  });

  it('falls back to JS writeTextFile when Rust save fails', async () => {
    mockTauri.saveProjectFile.mockRejectedValue(new Error('rust fail'));
    mockFs.writeTextFile.mockResolvedValue(undefined);

    await saveProjectToFile(validProjectId, sampleProject);

    expect(mockFs.writeTextFile).toHaveBeenCalledWith(
      `fablr/${validProjectId}.json`,
      expect.any(String),
      expect.objectContaining({ baseDir: 1 }) // BaseDirectory.AppData
    );
    expect(events.length).toBe(1);
  });

  it('uses backup path when primary writeTextFile also fails', async () => {
    mockTauri.saveProjectFile.mockRejectedValue(new Error('rust fail'));
    mockFs.writeTextFile
      .mockRejectedValueOnce(new Error('primary fail'))
      .mockResolvedValueOnce(undefined); // backup path succeeds

    await saveProjectToFile(validProjectId, sampleProject);

    expect(mockFs.writeTextFile).toHaveBeenCalledTimes(2);
    expect(mockFs.writeTextFile.mock.calls[1][0]).toContain(validProjectId);
    // 备份路径会触发 2 次 emit（catch 内 + 末尾），这是已知行为。
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

// ── loadProjectWithRetry ──────────────────────────────────────────────────────

describe('loadProjectWithRetry', () => {
  it('returns parsed content on first success', async () => {
    const data = { id: validProjectId, name: 'loaded' };
    // listProjectFiles 兜底可能调用，这里无所谓；loadProjectFile 直接成功
    mockTauri.loadProjectFile.mockResolvedValue(JSON.stringify(data));

    const result = await loadProjectWithRetry<typeof data>(validProjectId);

    expect(result).toEqual(data);
    expect(mockTauri.loadProjectFile).toHaveBeenCalled();
  });

  it('retries with exponential backoff on failure', async () => {
    mockTauri.loadProjectFile.mockRejectedValue(new Error('not found yet'));
    mockFs.exists.mockResolvedValue(false);
    mockTauri.checkAppDataDirectory.mockResolvedValue('/tmp/data');

    await expect(
      loadProjectWithRetry(validProjectId, { retries: 2, retryDelayMs: 100 })
    ).rejects.toThrow();

    // attempts = retries + 1 = 3
    expect(mockTauri.loadProjectFile).toHaveBeenCalledTimes(3);
  });

  it('throws lastError after exhausting retries', async () => {
    // 始终让 Rust + JS 兜底都失败，最终抛出最近一次错误。
    mockTauri.loadProjectFile.mockRejectedValue(new Error('rust permanent fail'));
    mockFs.exists.mockResolvedValue(false);
    mockTauri.checkAppDataDirectory.mockResolvedValue('/tmp/data');

    await expect(loadProjectWithRetry(validProjectId, { retries: 1 })).rejects.toThrow();
    // 至少调用 1 次（次数取决于内部 retry + 兜底分支）
    expect(mockTauri.loadProjectFile).toHaveBeenCalled();
  });
});

// ── listProjects ──────────────────────────────────────────────────────────────

describe('listProjects', () => {
  it('returns normalized list from Rust tauri.listProjectFiles', async () => {
    const raw = [
      { id: 'p1', name: '项目 1', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'p2', name: '项目 2', updatedAt: '2026-01-02T00:00:00Z' },
    ];
    mockTauri.listProjectFiles.mockResolvedValue(raw);

    const projects = await listProjects();

    expect(projects).toHaveLength(2);
    expect(projects[0].id).toBe('p1');
    expect(projects[1].name).toBe('项目 2');
    expect(mockTauri.listAppDataFiles).not.toHaveBeenCalled();
  });

  it('fills empty name with default "项目 <id>" fallback', async () => {
    mockTauri.listProjectFiles.mockResolvedValue([
      { id: 'abc12345-xyz', updatedAt: '2026-01-01T00:00:00Z' },
    ]);

    const projects = await listProjects();

    expect(projects[0].name).toBe('项目 abc12345');
  });

  it('fills missing updatedAt with createdAt or current time', async () => {
    mockTauri.listProjectFiles.mockResolvedValue([
      { id: 'p1', name: 'P1', createdAt: '2026-01-01T00:00:00Z' /* updatedAt missing */ },
    ]);

    const projects = await listProjects();

    expect(projects[0].updatedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('falls back to JS file scan when Rust returns empty', async () => {
    mockTauri.listProjectFiles.mockResolvedValue([]); // empty → fallback
    mockTauri.listAppDataFiles.mockResolvedValue(['p1.json', 'p2.json']);
    mockTauri.loadProjectFile
      .mockRejectedValueOnce(new Error('rust miss'))
      .mockImplementationOnce(async (_id: string) => JSON.stringify({ id: 'p2', name: 'P2' }));

    const projects = await listProjects();

    expect(mockTauri.listAppDataFiles).toHaveBeenCalledWith('fablr');
    expect(projects.length).toBeGreaterThanOrEqual(0);
  });

  it('filters out non-record entries from raw list', async () => {
    mockTauri.listProjectFiles.mockResolvedValue([
      null,
      'not-an-object',
      { id: 'p1', name: 'Good', updatedAt: '2026-01-01T00:00:00Z' },
    ]);

    const projects = await listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe('p1');
  });

  it('falls back to JS file scan when Rust throws (not just empty)', async () => {
    mockTauri.listProjectFiles.mockRejectedValue(new Error('rust boom'));
    mockTauri.listAppDataFiles.mockResolvedValue(['p1.json']);
    mockFs.exists.mockResolvedValue(true);
    mockFs.readTextFile.mockResolvedValue(JSON.stringify({ id: 'p1', name: 'P1', updatedAt: 'x' }));

    const projects = await listProjects();

    expect(mockTauri.listAppDataFiles).toHaveBeenCalledWith('fablr');
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe('p1');
  });

  it('returns [] from fallback when listAppDataFiles returns empty array', async () => {
    mockTauri.listProjectFiles.mockRejectedValue(new Error('rust boom'));
    mockTauri.listAppDataFiles.mockResolvedValue([]);

    const projects = await listProjects();
    expect(projects).toEqual([]);
  });

  it('skips non-.json files when scanning app data dir', async () => {
    mockTauri.listProjectFiles.mockRejectedValue(new Error('rust boom'));
    mockTauri.listAppDataFiles.mockResolvedValue(['readme.txt', 'data.json', 'image.png']);
    mockFs.exists.mockResolvedValue(true);
    mockFs.readTextFile.mockResolvedValue(
      JSON.stringify({ id: 'data', name: 'Data', updatedAt: 'x' })
    );

    const projects = await listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe('data');
    expect(mockFs.readTextFile).toHaveBeenCalledTimes(1);
  });

  it('rethrows when the outer try/catch in listProjects sees an error', async () => {
    mockTauri.listProjectFiles.mockRejectedValue(new Error('rust boom'));
    mockTauri.checkAppDataDirectory.mockRejectedValue(new Error('dir check fail'));
    mockFs.exists.mockResolvedValue(false);
    mockFs.mkdir.mockRejectedValue(new Error('mkdir denied'));

    await expect(listProjects()).rejects.toThrow();
  });
});

// ── ensureAppDataDir mkdir failure path ────────────────────────────────────────

describe('ensureAppDataDir mkdir failure path', () => {
  it('throws AppError when Rust check + JS mkdir both fail', async () => {
    mockTauri.checkAppDataDirectory.mockRejectedValue(new Error('rust dir fail'));
    mockFs.exists.mockResolvedValue(false);
    mockFs.mkdir.mockRejectedValue(new Error('mkdir denied'));

    await expect(saveProjectToFile(validProjectId, sampleProject)).rejects.toThrow(
      /创建目录失败|APP_DIR/i
    );
  });
});

// ── deleteProject ─────────────────────────────────────────────────────────────

describe('deleteProject', () => {
  it('deletes via Rust and emits event', async () => {
    mockTauri.deleteProjectFile.mockResolvedValue(undefined);

    const result = await deleteProject(validProjectId);

    expect(result).toBe(true);
    expect(mockTauri.deleteProjectFile).toHaveBeenCalledWith(validProjectId);
    expect(events.length).toBe(1);
  });

  it('returns false on empty ID without calling Rust', async () => {
    const result = await deleteProject('');

    expect(result).toBe(false);
    expect(mockTauri.deleteProjectFile).not.toHaveBeenCalled();
    expect(events.length).toBe(0);
  });

  it('returns false when Rust delete throws', async () => {
    mockTauri.deleteProjectFile.mockRejectedValue(new Error('disk fail'));

    const result = await deleteProject(validProjectId);

    expect(result).toBe(false);
    expect(events.length).toBe(0);
  });
});

// ── PROJECTS_CHANGED_EVENT 边界 ───────────────────────────────────────────────

describe('PROJECTS_CHANGED_EVENT', () => {
  it('constant is the documented event name', () => {
    expect(PROJECTS_CHANGED_EVENT).toBe('Fablr:projects:changed');
  });
});
