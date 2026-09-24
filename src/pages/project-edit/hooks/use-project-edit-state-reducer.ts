/**
 * useProjectEditState — reducer backing the ProjectEdit page.
 *
 * Replaces 17 individual `useState` calls (formName/formDescription,
 * currentStep/saving/project, videoPath/videoSelected/videoMetadata/keyFrames,
 * scriptSegments, isNewProject/initialLoading/error, saveBehavior/autoSaveEnabled,
 * reloadToken) with a single useReducer that supports both value and
 * updater setter signatures.
 *
 * Consolidation: the reducer now reuses the shared `genericUpdateReducer`
 * from `@/shared/hooks/use-auto-setters` and the auto-setters factory
 * (see `use-project-edit-state.ts`). All bespoke action/setter boilerplate
 * and the local updater alias have been removed — this is the DRY win from
 * Pass 3 of the reducer-consolidation step.
 */
import type { ProjectData } from '../project-edit-utils';
import type { ProjectSaveBehavior } from '@/shared/constants/constants';
import type { VideoMetadata } from '@/core/video';
import type { ScriptSegment } from '@/types';
import { genericUpdateReducer } from '@/shared/hooks/use-auto-setters';

/** All page state in one shape. Fields grouped loosely by feature category. */
export interface ProjectEditState {
  // Form (top-level text inputs)
  formName: string;
  formDescription: string;

  // Project + step navigation
  project: ProjectData | null;
  isNewProject: boolean;
  currentStep: number;
  saving: boolean;
  initialLoading: boolean;
  error: string | null;
  reloadToken: number;

  // Video + analysis pipeline
  videoPath: string;
  videoSelected: boolean;
  videoMetadata: VideoMetadata | null;
  keyFrames: string[];
  scriptSegments: ScriptSegment[];

  // Settings (persisted to localStorage by the caller, not in this reducer)
  saveBehavior: ProjectSaveBehavior;
  autoSaveEnabled: boolean;
}

/**
 * Generic update reducer shared across project pages. Handles only the
 * `{ type: 'update'; key; updater }` action shape. `updater` may be a value
 * (set directly) or a function `(prev) => next`. Any non-`'update'` action
 * returns the state unchanged.
 */
export const projectEditReducer = genericUpdateReducer<ProjectEditState>;

/**
 * Build a fresh state. Reads persisted settings from localStorage and
 * computes a default project name from the current timestamp. Kept as a
 * factory (not a const) so each useReducer call gets a fresh object —
 * React would otherwise reuse the reference across re-mounts.
 */
export function createInitialProjectEditState(
  defaultProjectName: string,
  readSaveBehavior: () => ProjectSaveBehavior,
  readAutoSaveEnabled: () => boolean,
): ProjectEditState {
  return {
    formName: defaultProjectName,
    formDescription: '',
    project: null,
    isNewProject: true,
    currentStep: 0,
    saving: false,
    initialLoading: false,
    error: null,
    reloadToken: 0,
    videoPath: '',
    videoSelected: false,
    videoMetadata: null,
    keyFrames: [],
    scriptSegments: [],
    saveBehavior: readSaveBehavior(),
    autoSaveEnabled: readAutoSaveEnabled(),
  };
}
