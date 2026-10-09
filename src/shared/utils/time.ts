/**
 * 影视解说与配音特定辅助工具
 */

export function formatScriptDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0秒';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}分${s.toString().padStart(2, '0')}秒`;
  return `${s}秒`;
}

export function estimateVoiceDuration(text: string, charsPerSec = 4): number {
  if (!text) return 0;
  const clean = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  return Math.max(1, Math.round(clean.length / charsPerSec));
}
