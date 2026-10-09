/**
 * 客户端版本更新契约定义
 */

export type UpdateCheckStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export type AutoCheckFrequency = 'launch' | 'daily' | 'manual';

export interface ReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
  contentType: string;
  platform?: 'macos' | 'windows' | 'linux' | 'unknown';
}

export interface AppUpdateInfo {
  version: string;
  currentVersion: string;
  releaseDate: string;
  releaseTitle: string;
  releaseNotes: string;
  downloadUrl: string;
  matchedAsset?: ReleaseAsset;
  assets?: ReleaseAsset[];
  isMandatory?: boolean;
}
