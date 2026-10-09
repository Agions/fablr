const onceCache = new Map<string, Promise<unknown>>();

const runOnce = (key: string, loader: () => Promise<unknown>): Promise<unknown> => {
  const cached = onceCache.get(key);
  if (cached) return cached;
  const task = loader().catch((error) => {
    onceCache.delete(key);
    throw error;
  });
  onceCache.set(key, task);
  return task;
};

export const preloadProjectsPage = (): Promise<unknown> =>
  runOnce('page:projects', () => import('../../pages/projects/index'));

export const preloadProjectEditPage = (): Promise<unknown> =>
  runOnce('page:project-edit', () => import('../../pages/project-edit/index'));

export const preloadProjectDetailPage = (): Promise<unknown> =>
  runOnce('page:project-detail', () => import('../../pages/project-detail/index'));

export const preloadWorkspacePage = (): Promise<unknown> =>
  runOnce('page:workspace', () => import('../../pages/workspace/index'));

export const preloadAIVideoEditorPage = preloadWorkspacePage;

export const preloadSettingsPage = (): Promise<unknown> =>
  runOnce('page:settings', () => import('../../pages/settings/index'));
