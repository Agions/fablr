import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '@/shared/utils/logging';
import { notify } from '@/shared';
import {
  listProjects,
  deleteProject,
  PROJECTS_CHANGED_EVENT,
  emitProjectsChanged,
  type ProjectFileData,
} from '@/core/services/project/project-file-service';
import type {
  ProjectStatus,
  ProjectUIStats,
  ProjectView,
  ProjectStatusFilter,
} from '@/types/project';
import type { ProjectUIStatus } from '@/shared/types';

export type { ProjectStatus, ProjectUIStatus, ProjectUIStats, ProjectView, ProjectStatusFilter };
export { PROJECTS_CHANGED_EVENT, emitProjectsChanged };

// 转换函数：将数据转换为 ProjectView
const asProjectView = (p: ProjectFileData): ProjectView => ({
  id: p.id || '',
  name: p.name || '未命名项目',
  description: p.description || '',
  status: (p.status || 'draft') as ProjectUIStatus,
  createdAt: p.createdAt || new Date().toISOString(),
  updatedAt: p.updatedAt || p.createdAt || new Date().toISOString(),
  scripts: (p.scripts as ProjectView['scripts']) || [],
  videos:
    (p.videos as ProjectView['videos']) ||
    (p.videoPath ? ([{ path: p.videoPath }] as unknown as ProjectView['videos']) : []),
  videoPath: p.videoPath || '',
});

// 状态配置 — 所有合法 status 都应有一个显示配置，'failed' 等价于 'draft' 视图色
function buildStatusConfig(): Record<ProjectStatus, { color: string; text: string }> {
  return {
    draft: { color: 'secondary', text: '草稿' },
    processing: { color: 'default', text: '制作中' },
    completed: { color: 'success', text: '已完成' },
    failed: { color: 'destructive', text: '失败' },
  };
}

export const statusConfig: Record<ProjectStatus, { color: string; text: string }> =
  buildStatusConfig();

// 计算项目 UI 状态
export function getProjectUIStatus(project: ProjectView): ProjectUIStats {
  const scriptCount = Array.isArray(project.scripts) ? project.scripts.length : 0;
  const videoCount =
    Array.isArray(project.videos) && project.videos.length > 0
      ? project.videos.length
      : project.videoPath
        ? 1
        : 0;
  const status: ProjectUIStatus =
    project.status === 'completed'
      ? 'completed'
      : project.status === 'processing'
        ? 'processing'
        : 'draft';
  let progress = 0;
  if (status === 'completed') progress = 100;
  else if (status === 'processing') progress = 65;
  else if (scriptCount > 0 && videoCount > 0) progress = 45;
  else if (videoCount > 0) progress = 20;
  return { scriptCount, videoCount, status, progress };
}

interface UseProjectListOptions {
  recentProjects?: string[];
}

interface UseProjectListReturn {
  // 状态
  projects: ProjectView[];
  viewMode: 'grid' | 'list';
  searchText: string;
  statusFilter: ProjectStatusFilter;
  loading: boolean;
  loadFailed: boolean;
  deleteConfirmId: string | null;

  // 计算属性
  orderedProjects: ProjectView[];
  filteredProjects: ProjectView[];
  statusFilters: Array<{
    label: string;
    value: number;
    color: string;
    filter: ProjectStatusFilter;
  }>;

  // 操作方法
  loadProjectData: () => Promise<void>;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSearchText: (text: string) => void;
  setStatusFilter: (filter: ProjectStatusFilter) => void;
  setDeleteConfirmId: (id: string | null) => void;
  confirmDelete: (id: string) => Promise<void>;

  // 动作生成
  projectActions: (project: ProjectView) => Array<{
    key: string;
    label?: string;
    icon?: React.ReactNode;
    danger?: boolean;
    onClick?: () => void;
    type?: 'divider';
  }>;
}

export function useProjectList(options: UseProjectListOptions = {}): UseProjectListReturn {
  const { recentProjects = [] } = options;

  // 状态
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 加载项目数据
  const loadProjectData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const data = await listProjects();
      const mapped = (Array.isArray(data) ? data : [])
        .map(asProjectView);
      setProjects(mapped);
    } catch (error) {
      logger.error('加载项目列表失败:', { error });
      notify.error(error, '加载项目列表失败，请稍后重试');
      setProjects([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化加载 + 事件监听
  useEffect(() => {
    void loadProjectData();
    const handleProjectsChanged = () => {
      void loadProjectData();
    };
    window.addEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged);
    return () => {
      window.removeEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged);
    };
  }, [loadProjectData]);

  // 排序后的项目（最近项目优先）
  const orderedProjects = useMemo(() => {
    const recentOrder = new Map(recentProjects.map((id, index) => [id, index]));
    return [...projects].sort((a, b) => {
      const aOrder = recentOrder.get(a.id);
      const bOrder = recentOrder.get(b.id);
      if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, recentProjects]);

  // 过滤后的项目
  const filteredProjects = orderedProjects.filter(p => {
    const matchSearch =
      !searchText || p.name.includes(searchText) || p.description?.includes(searchText);
    const uiStatus = getProjectUIStatus(p).status;
    const matchStatus = statusFilter === 'all' || uiStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  // 删除确认
  const confirmDelete = useCallback(
    async (id: string) => {
      try {
        const ok = await deleteProject(id);
        if (!ok) {
          notify.error(null, '删除项目失败');
          setDeleteConfirmId(null);
          return;
        }
        notify.success('项目已删除');
        await loadProjectData();
      } catch (error) {
        logger.error('删除项目失败:', { error });
        notify.error(error, '删除项目失败，请稍后重试');
      }
      setDeleteConfirmId(null);
    },
    [loadProjectData]
  );

  // 生成项目操作按钮
  const projectActions = useCallback(
    (project: ProjectView) => [
      { key: 'edit', label: '编辑项目', icon: null, onClick: () => {} },
      { key: 'editor', label: '进入工作台', icon: null, onClick: () => {} },
      { key: 'export', label: '导出', icon: null },
      { key: 'divider', type: 'divider' as const },
      {
        key: 'delete',
        label: '删除',
        icon: null,
        danger: true,
        onClick: () => setDeleteConfirmId(project.id),
      },
    ],
    []
  );

  // 状态过滤器数据（颜色用 DESIGN.md §2 CSS var，自动响应主题）
  const statusFilters = useMemo(
    () => [
      {
        label: '全部',
        value: projects.length,
        color: 'var(--accent-primary)',
        filter: 'all' as ProjectStatusFilter,
      },
      {
        label: '草稿',
        value: projects.filter(p => getProjectUIStatus(p).status === 'draft').length,
        color: 'var(--text-tertiary)',
        filter: 'draft' as ProjectStatusFilter,
      },
      {
        label: '制作中',
        value: projects.filter(p => getProjectUIStatus(p).status === 'processing').length,
        color: 'var(--accent-amber)',
        filter: 'processing' as ProjectStatusFilter,
      },
      {
        label: '已完成',
        value: projects.filter(p => getProjectUIStatus(p).status === 'completed').length,
        color: 'var(--accent-success)',
        filter: 'completed' as ProjectStatusFilter,
      },
    ],
    [projects]
  );

  return {
    // 状态
    projects,
    viewMode,
    searchText,
    statusFilter,
    loading,
    loadFailed,
    deleteConfirmId,

    // 计算属性
    orderedProjects,
    filteredProjects,
    statusFilters,

    // 操作方法
    loadProjectData,
    setViewMode,
    setSearchText,
    setStatusFilter,
    setDeleteConfirmId,
    confirmDelete,

    // 动作生成
    projectActions,
  };
}
