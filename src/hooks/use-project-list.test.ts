/**
 * use-project-list 测试
 *
 * Stage 9 PR-12：项目列表 hook 覆盖
 * - listProjects / deleteProject / 事件订阅
 * - 搜索 / 状态过滤 / 排序
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/core/services/project/project-file-service', () => ({
  listProjects: vi.fn(),
  deleteProject: vi.fn(),
  PROJECTS_CHANGED_EVENT: 'Fablr:projects:changed',
}));

vi.mock('@/shared', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  listProjects,
  deleteProject,
  PROJECTS_CHANGED_EVENT,
} from '@/core/services/project/project-file-service';
import { notify } from '@/shared';
import { useProjectList, getProjectUIStatus, statusConfig } from './use-project-list';
import type { ProjectView } from '@/types/project';
import type { ProjectFileData } from '@/core/services/project/project-file-service';

/**
 * 测试本地使用的 ProjectView 类型子集。
 * ProjectFileData 已在 project-file-service 导出（用于测试 listProjects mock 返回）。
 */
type TestProjectView = Pick<
  ProjectView,
  | 'id'
  | 'name'
  | 'description'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'scripts'
  | 'videos'
  | 'videoPath'
>;

const sample = (id: string, overrides: Partial<TestProjectView> = {}): ProjectView => ({
  id,
  name: `Project ${id}`,
  description: 'desc',
  status: 'draft',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  scripts: [],
  videos: [],
  videoPath: '',
  ...overrides,
});

/** 测试辅助：把 ProjectView 转换为 ProjectFileData（用于 listProjects mock）。 */
const asFileData = (v: ProjectView): ProjectFileData => v as unknown as ProjectFileData;

describe('useProjectList', () => {
  beforeEach(() => {
    vi.mocked(listProjects).mockResolvedValue([
      asFileData(sample('a')),
      asFileData(sample('b', { status: 'completed' })),
    ]);
    vi.mocked(deleteProject).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state then populates projects', async () => {
    const { result } = renderHook(() => useProjectList());
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.loadFailed).toBe(false);
  });

  it('records loadFailed and notifies on error', async () => {
    vi.mocked(listProjects).mockRejectedValue(new Error('storage down'));
    const { result } = renderHook(() => useProjectList());
    await waitFor(() => {
      expect(result.current.loadFailed).toBe(true);
    });
    expect(result.current.projects).toEqual([]);
    expect(notify.error).toHaveBeenCalled();
  });

  it('filters by search text', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      asFileData(sample('a', { name: 'Alpha' })),
      asFileData(sample('b', { name: 'Beta' })),
    ]);
    const { result } = renderHook(() => useProjectList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setSearchText('Alpha'));
    expect(result.current.filteredProjects.map(p => p.name)).toEqual(['Alpha']);
  });

  it('filters by status', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      asFileData(sample('a', { status: 'draft' })),
      asFileData(sample('b', { status: 'completed' })),
    ]);
    const { result } = renderHook(() => useProjectList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setStatusFilter('completed'));
    expect(result.current.filteredProjects.map(p => p.id)).toEqual(['b']);
  });

  it('orderedProjects: recentProjects come first', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      asFileData(sample('a', { updatedAt: '2026-02-01T00:00:00Z' })),
      asFileData(sample('b', { updatedAt: '2026-01-01T00:00:00Z' })),
    ]);
    const { result } = renderHook(() => useProjectList({ recentProjects: ['b'] }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orderedProjects.map(p => p.id)).toEqual(['b', 'a']);
  });

  it('orderedProjects: non-recent fall back to updatedAt desc', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      asFileData(sample('old', { updatedAt: '2026-01-01T00:00:00Z' })),
      asFileData(sample('new', { updatedAt: '2026-03-01T00:00:00Z' })),
    ]);
    const { result } = renderHook(() => useProjectList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orderedProjects.map(p => p.id)).toEqual(['new', 'old']);
  });

  it('orderedProjects: both in recentProjects → sort by recent order (L169)', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      asFileData(sample('a', { updatedAt: '2026-02-01T00:00:00Z' })),
      asFileData(sample('b', { updatedAt: '2026-01-01T00:00:00Z' })),
    ]);
    // recent order: ['b', 'a'] — a is newer but should come second
    const { result } = renderHook(() => useProjectList({ recentProjects: ['b', 'a'] }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orderedProjects.map(p => p.id)).toEqual(['b', 'a']);
  });

  it('orderedProjects: only b in recentProjects, a not → b before a (L171)', async () => {
    // With 3 elements, the comparator must compare b against a (and c) in
    // both orderings, eventually invoking L171 where aOrder===undefined
    // and bOrder!==undefined in one direction.
    vi.mocked(listProjects).mockResolvedValue([
      asFileData(sample('a', { updatedAt: '2026-02-01T00:00:00Z' })),
      asFileData(sample('b', { updatedAt: '2026-01-01T00:00:00Z' })),
      asFileData(sample('c', { updatedAt: '2026-03-01T00:00:00Z' })),
    ]);
    const { result } = renderHook(() => useProjectList({ recentProjects: ['b'] }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // b must precede a (and c)
    expect(result.current.orderedProjects.map(p => p.id).indexOf('b')).toBeLessThan(
      result.current.orderedProjects.map(p => p.id).indexOf('a')
    );
  });

  it('switches viewMode', () => {
    const { result } = renderHook(() => useProjectList());
    expect(result.current.viewMode).toBe('grid');
    act(() => result.current.setViewMode('list'));
    expect(result.current.viewMode).toBe('list');
  });

  it('confirmDelete: success path reloads and notifies', async () => {
    const { result } = renderHook(() => useProjectList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.confirmDelete('a');
    });
    expect(deleteProject).toHaveBeenCalledWith('a');
    expect(notify.success).toHaveBeenCalledWith('项目已删除');
    expect(listProjects).toHaveBeenCalledTimes(2);
  });

  it('confirmDelete: false return notifies error', async () => {
    vi.mocked(deleteProject).mockResolvedValue(false);
    const { result } = renderHook(() => useProjectList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.confirmDelete('a');
    });
    expect(notify.error).toHaveBeenCalledWith(null, '删除项目失败');
  });

  it('confirmDelete: exception is logged and notified', async () => {
    vi.mocked(deleteProject).mockRejectedValue(new Error('disk fail'));
    const { result } = renderHook(() => useProjectList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.confirmDelete('a');
    });
    expect(notify.error).toHaveBeenCalled();
  });

  it('listens to PROJECTS_CHANGED_EVENT and reloads', async () => {
    const { result } = renderHook(() => useProjectList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = vi.mocked(listProjects).mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED_EVENT));
      // allow microtask to flush
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(vi.mocked(listProjects).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('projectActions: returns expected shape', () => {
    const { result } = renderHook(() => useProjectList());
    const actions = result.current.projectActions(sample('a'));
    const keys = actions.map(a => a.key);
    expect(keys).toEqual(['edit', 'editor', 'export', 'divider', 'delete']);
    const del = actions.find(a => a.key === 'delete')!;
    expect(del.danger).toBe(true);
  });

  it('projectActions: delete onClick sets deleteConfirmId (L217)', () => {
    const { result } = renderHook(() => useProjectList());
    const actions = result.current.projectActions(sample('a'));
    const del = actions.find(a => a.key === 'delete')!;
    expect(typeof del.onClick).toBe('function');
    act(() => del.onClick!());
    expect(result.current.deleteConfirmId).toBe('a');
  });

  it('statusFilters: counts per status', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      asFileData(sample('a', { status: 'draft' })),
      asFileData(sample('b', { status: 'draft' })),
      asFileData(sample('c', { status: 'processing' })),
      asFileData(sample('d', { status: 'completed' })),
    ]);
    const { result } = renderHook(() => useProjectList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const all = result.current.statusFilters.find(f => f.filter === 'all')!;
    const draft = result.current.statusFilters.find(f => f.filter === 'draft')!;
    expect(all.value).toBe(4);
    expect(draft.value).toBe(2);
  });

  it('statusConfig covers all 4 statuses', () => {
    expect(statusConfig.draft).toBeDefined();
    expect(statusConfig.processing).toBeDefined();
    expect(statusConfig.completed).toBeDefined();
    expect(statusConfig.failed).toBeDefined();
  });

  it('getProjectUIStatus: completed → 100%', () => {
    const ui = getProjectUIStatus(sample('a', { status: 'completed' }));
    expect(ui.progress).toBe(100);
    expect(ui.status).toBe('completed');
  });

  it('getProjectUIStatus: processing → 65%', () => {
    const ui = getProjectUIStatus(sample('a', { status: 'processing' }));
    expect(ui.progress).toBe(65);
    expect(ui.status).toBe('processing');
  });

  it('getProjectUIStatus: scripts+videos → 45%', () => {
    const ui = getProjectUIStatus(
      sample('a', {
        status: 'draft',
        scripts: [{ id: 's' }] as never,
        videos: [{ id: 'v' }] as never,
      })
    );
    expect(ui.progress).toBe(45);
  });

  it('getProjectUIStatus: videos only → 20%', () => {
    const ui = getProjectUIStatus(
      sample('a', {
        status: 'draft',
        videos: [{ id: 'v' }] as never,
      })
    );
    expect(ui.progress).toBe(20);
  });

  it('setDeleteConfirmId updates state', () => {
    const { result } = renderHook(() => useProjectList());
    act(() => result.current.setDeleteConfirmId('xyz'));
    expect(result.current.deleteConfirmId).toBe('xyz');
    act(() => result.current.setDeleteConfirmId(null));
    expect(result.current.deleteConfirmId).toBeNull();
  });
});
