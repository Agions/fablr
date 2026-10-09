export interface MediaSourceItem {
  id: string;
  name: string;
  duration: string;
  type: 'video' | 'audio';
  bgGradient?: string;
}

export interface ScriptTimelineBlock {
  id: string;
  type: 'hook' | 'act' | 'climax' | 'ending';
  label: string;
  text: string;
  durationSec: number;
  linkedClipName: string;
  color: string;
}
