/**
 * Fablr Workspace — 剧本与解说风格共享配置
 * 文案风格、解说风格预设、文案长度选项及生成属性
 */

import type { ScriptData } from '@/types';
import type { WorkflowFeatureType } from '@/core/workflow';
import { OUT_PINK } from '@/core/video/output-colors';

// 文案风格选项
export const SCRIPT_STYLES = [
  { value: 'formal', label: '正式' },
  { value: 'casual', label: '轻松' },
  { value: 'humor', label: '幽默' },
  { value: 'emotional', label: '情感' },
  { value: 'shocking', label: '震惊' },
  { value: 'professional', label: '专业' },
];

// 解说风格预设 (用于解说模式)
export const COMMENTARY_STYLES = [
  {
    value: 'humor',
    label: '幽默风趣',
    desc: '轻松诙谐，吸引眼球',
    icon: '😄',
    color: 'var(--accent-primary)',
  },
  {
    value: 'casual',
    label: '自然随意',
    desc: '口语化表达，贴近生活',
    icon: '🎯',
    color: 'var(--accent-success)',
  },
  {
    value: 'shocking',
    label: '震惊吸引',
    desc: '制造悬念，引发好奇',
    icon: '⚡',
    color: 'var(--accent-danger)',
  },
  {
    value: 'emotional',
    label: '情感共鸣',
    desc: '讲故事，打动人心',
    icon: '💖',
    color: `var(--accent-pink, ${OUT_PINK})`,
  },
  {
    value: 'professional',
    label: '专业深度',
    desc: '分析解读，树立权威',
    icon: '📚',
    color: 'var(--accent-secondary)',
  },
];

// 文案长度选项
export const SCRIPT_LENGTHS = [
  { value: 'short', label: '短视频', time: '~30s' },
  { value: 'medium', label: '中视频', time: '1-3min' },
  { value: 'long', label: '长视频', time: '3-10min' },
];

export interface ScriptGenerateProps {
  onNext?: () => void;
  setNarrationScript?: (data: ScriptData) => void;
  setRemixScript?: (data: ScriptData) => void;
  setFeature?: (feature: WorkflowFeatureType) => void;
  goToNextStep?: () => void;
}
