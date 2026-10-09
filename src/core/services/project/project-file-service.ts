/**
 * Project File Service
 * All project file operations: save, load, list, delete, app data dir management.
 * Single source of truth for project file operations.
 */
import { tauri } from '@/core/tauri';
import { readTextFile, writeTextFile, BaseDirectory, exists, mkdir } from '@tauri-apps/plugin-fs';
import { normalizeProjectId, buildProjectIdCandidates } from '@/core/utils/project-id';
import { logger } from '@/shared/utils/logging';
import { getConfigDir } from '@/core/utils/config-dir';
import { AppError } from '@/core/errors';
import { atomicFileDriver } from './atomic-file-driver';

const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export const PROJECTS_CHANGED_EVENT = 'Fablr:projects:changed';

const emitProjectsChanged = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED_EVENT));
  }
};

export type ProjectFileData = {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  scripts?: unknown[];
  videos?: unknown[];
  videoPath?: string;
  aiModel?: { apiKey?: string; [key: string]: unknown };
  [key: string]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeListedProject = (value: unknown): ProjectFileData | null => {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === 'string' ? value.id : '';
  const fallbackId = typeof value.projectId === 'string' ? value.projectId : '';
  const normalizedId = normalizeProjectId(rawId || fallbackId);
  if (!normalizedId) return null;
  const merged: ProjectFileData = { ...value, id: normalizedId };
  if (typeof merged.name !== 'string' || !merged.name.trim()) {
    merged.name = `项目 ${normalizedId.slice(0, 8)}`;
  }
  if (typeof merged.updatedAt !== 'string') {
    merged.updatedAt =
      typeof merged.createdAt === 'string' ? merged.createdAt : new Date().toISOString();
  }
  return merged;
};

const ensureAppDataDir = async (): Promise<void> => {
  const appDir = 'fablr';
  try {
    const dirPath = await tauri.checkAppDataDirectory();
    logger.info('Rust目录检查成功', { dirPath });
    return;
  } catch (rustError) {
    logger.warn('Rust目录检查失败，回退到前端检查', { rustError });
  }
  const dirExists = await exists(appDir, { baseDir: BaseDirectory.AppData }).catch(e => {
    logger.error('检查目录是否存在时出错', { e });
    throw new AppError('APP_DIR_CHECK_FAILED', `检查目录出错: ${errMsg(e)}`, {
      originalError: e,
      userMessage: '检查数据目录失败',
    });
  });
  if (dirExists) return;
  logger.info('应用数据目录不存在，创建目录', { appDir });
  await mkdir(appDir, { baseDir: BaseDirectory.AppData, recursive: true }).catch(e => {
    logger.error('创建目录失败', { e });
    throw new AppError('APP_DIR_CREATE_FAILED', `创建目录失败: ${errMsg(e)}`, {
      originalError: e,
      userMessage: '创建数据目录失败',
    });
  });
  const checkExists = await exists(appDir, { baseDir: BaseDirectory.AppData }).catch(() => false);
  if (!checkExists)
    throw new AppError('APP_DIR_CREATE_DENIED', '无法创建应用数据目录，请检查权限', {
      userMessage: '无法创建数据目录，请检查权限',
    });
  logger.info('应用数据目录创建成功');
};

export const saveProjectToFile = async (projectId: string, project: object): Promise<void> => {
  const normalizedProjectId = normalizeProjectId(projectId || '');
  if (!project || !normalizedProjectId)
    throw new AppError('APP_PROJECT_INVALID', '无效的项目数据', {
      userMessage: '无效的项目数据',
    });

  // 使用 AtomicProjectFileDriver 队列防并发冲突
  await atomicFileDriver.writeAtomic(normalizedProjectId, project, async (cleanData: object) => {
    await ensureAppDataDir().catch(err => {
      throw new AppError('APP_DIR_ERROR', `应用数据目录错误: ${err.message || '未知错误'}`, {
        originalError: err,
        userMessage: '数据目录错误',
      });
    });
    const cleanProject = { ...(cleanData as ProjectFileData) };
    if (cleanProject.aiModel?.apiKey) {
      cleanProject.aiModel = { ...cleanProject.aiModel, apiKey: undefined };
    }
    const projectData = JSON.stringify(cleanProject, null, 2);
    if (!projectData)
      throw new AppError('APP_PROJECT_SERIALIZE_EMPTY', '项目数据序列化为空', {
        userMessage: '项目数据为空',
      });
    const projectPath = `fablr/${normalizedProjectId}.json`;
    try {
      await tauri.saveProjectFile(normalizedProjectId, projectData);
      emitProjectsChanged();
      logger.info('文件写入成功 (通过Rust函数)', { projectPath });
      return;
    } catch (rustErr) {
      logger.warn('通过Rust保存文件失败，尝试使用JS API保存', { rustErr });
    }
    await writeTextFile(projectPath, projectData, { baseDir: BaseDirectory.AppData }).catch(
      async () => {
        const configDir = await getConfigDir();
        if (configDir) {
          const backupPath = `${configDir}${normalizedProjectId}.json`;
          await writeTextFile(backupPath, projectData);
          emitProjectsChanged();
          logger.info('使用备用路径保存成功', { backupPath });
        }
      }
    );
    emitProjectsChanged();
    logger.info('项目文件保存成功', { projectPath });
  });
};

const loadProjectFromFile = async <T = ProjectFileData>(projectId: string): Promise<T> => {
  const candidates = buildProjectIdCandidates(projectId);
  if (!candidates.length)
    throw new AppError('APP_PROJECT_ID_EMPTY', '项目ID不能为空', {
      userMessage: '项目ID不能为空',
    });
  let lastError: unknown = null;
  for (const candidateId of candidates) {
    try {
      try {
        const content = await tauri.loadProjectFile(candidateId);
        return JSON.parse(content) as T;
      } catch (rustError) {
        lastError = rustError;
        logger.warn(`通过 Rust 加载项目失败(${candidateId})，尝试使用 JS API 兜底:`, rustError);
      }
      const projectPath = `fablr/${candidateId}.json`;
      const legacyProjectPath = `story-fab/${candidateId}.json`;
      const existsFile = await exists(projectPath, { baseDir: BaseDirectory.AppData });
      if (existsFile) {
        const content = await readTextFile(projectPath, { baseDir: BaseDirectory.AppData });
        return JSON.parse(content) as T;
      }
      const existsLegacy = await exists(legacyProjectPath, { baseDir: BaseDirectory.AppData });
      if (existsLegacy) {
        const content = await readTextFile(legacyProjectPath, { baseDir: BaseDirectory.AppData });
        return JSON.parse(content) as T;
      }
      lastError = new Error(`项目文件不存在: ${candidateId}.json`);
      continue;
    } catch (error) {
      lastError = error;
    }
  }
  //兼容历史版本：尝试从旧配置目录加载
  try {
    const configDir = await getConfigDir();
    if (configDir) {
      for (const candidateId of candidates) {
        const legacyPaths = [
          `${configDir}${candidateId}.json`,
          `${configDir}fablr/${candidateId}.json`,
          `${configDir}story-fab/${candidateId}.json`,
        ];
        for (const legacyPath of legacyPaths) {
          try {
            const found = await exists(legacyPath);
            if (!found) continue;
            const content = await readTextFile(legacyPath);
            return JSON.parse(content) as T;
            } catch (legacyError) {
            lastError = legacyError;
          }
        }
      }
    }
  } catch (legacyRootError) {
    lastError = legacyRootError;
  }
  logger.error('读取项目文件失败', { lastError });
  throw lastError || new Error(`读取项目失败: ${projectId}`);
};

export const loadProjectWithRetry = async <T = ProjectFileData>(
  projectId: string,
  options?: { retries?: number; retryDelayMs?: number }
): Promise<T> => {
  const retries = Math.max(0, options?.retries ?? 2);
  const retryDelayMs = Math.max(100, options?.retryDelayMs ?? 220);
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await loadProjectFromFile<T>(projectId);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)));
    }
  }
  throw lastError || new Error(`读取项目失败: ${projectId}`);
};

export const listProjects = async (): Promise<ProjectFileData[]> => {
  try {
    try {
      const projects = await tauri.listProjectFiles();
      const normalized = (Array.isArray(projects) ? projects : [])
        .map(normalizeListedProject)
        .filter((item): item is ProjectFileData => item !== null);
      if (normalized.length > 0) {
        logger.info('[listProjects] Rust 项目列表获取成功', { count: normalized.length });
        return normalized;
      }
      logger.warn('[listProjects] Rust 项目列表为空，切换到文件扫描兜底');
    } catch (rustError) {
      logger.warn('[listProjects] Rust 获取失败，切换到 JS API 兜底:', rustError);
    }
    await ensureAppDataDir();
    const appDir = 'fablr';
    const files = (await tauri.listAppDataFiles(appDir)) as string[];
    if (!files || !Array.isArray(files) || files.length === 0) return [];
    const projects = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          try {
            const projectId = file.replace('.json', '');
            return await loadProjectFromFile(projectId);
          } catch (error) {
            logger.error(`[listProjects] 加载项目 ${file} 失败:`, error);
            return null;
          }
        })
    );
    return projects
      .map(normalizeListedProject)
      .filter((project): project is ProjectFileData => project !== null);
  } catch (error) {
    logger.error('[listProjects] 列出项目失败:', error);
    throw error;
  }
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
  try {
    const normalizedProjectId = normalizeProjectId(projectId || '');
    if (!normalizedProjectId) return false;
    await tauri.deleteProjectFile(normalizedProjectId);
    emitProjectsChanged();
    logger.info('项目删除成功', { projectId });
    return true;
  } catch (error) {
    logger.error('删除项目出错', { error });
    return false;
  }
};

export { emitProjectsChanged };
