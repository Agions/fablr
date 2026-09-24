/**
 * ExportSettings — 导出设置
 * Default format: shadcn Select (9:16/1:1/16:9)
 * Default quality: shadcn Select (High/Medium/Low)
 * Output folder: shadcn Input + button to browse
 */
import { memo } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { FolderOpen } from 'lucide-react';

interface ExportSettingsProps {
  defaultFormat?: '9:16' | '1:1' | '16:9';
  defaultQuality?: 'high' | 'medium' | 'low';
  outputPath?: string;
  onFormatChange?: (format: '9:16' | '1:1' | '16:9') => void;
  onQualityChange?: (quality: 'high' | 'medium' | 'low') => void;
  onOutputPathChange?: (path: string) => void;
}

const FORMAT_OPTIONS = [
  { value: '9:16', label: '9:16 竖屏', emoji: '📱' },
  { value: '1:1', label: '1:1 方屏', emoji: '🖼️' },
  { value: '16:9', label: '16:9 横屏', emoji: '🖥️' },
] as const;

const QUALITY_OPTIONS = [
  { value: 'high', label: 'High', desc: '最佳质量' },
  { value: 'medium', label: 'Medium', desc: '平衡' },
  { value: 'low', label: 'Low', desc: '最小体积' },
] as const;

export const ExportSettings = memo<ExportSettingsProps>(({
  defaultFormat = '9:16',
  defaultQuality = 'high',
  outputPath = '',
  onFormatChange,
  onQualityChange,
  onOutputPathChange,
}) => {
  return (
    <div className="flex flex-col gap-5">
      {/* Default format */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-secondary">Default Format</label>
        <div className="grid grid-cols-3 gap-2">
          {FORMAT_OPTIONS.map((fmt) => (
            <button
              key={fmt.value}
              onClick={() => onFormatChange?.(fmt.value)}
              className={`
                h-9 rounded-md border text-xs font-medium transition-colors flex flex-col items-center justify-center gap-0.5
                ${defaultFormat === fmt.value
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-subtle bg-bg-tertiary text-text-secondary hover:text-text-primary'
                }
              `}
            >
              <span>{fmt.emoji}</span>
              <span>{fmt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Default quality */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-secondary">Default Quality</label>
        <div className="flex gap-2">
          {QUALITY_OPTIONS.map((q) => (
            <button
              key={q.value}
              onClick={() => onQualityChange?.(q.value)}
              className={`
                h-8 px-3 rounded-md border text-xs font-medium transition-colors flex items-center gap-2
                ${defaultQuality === q.value
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-subtle bg-bg-tertiary text-text-secondary hover:text-text-primary'
                }
              `}
            >
              <span>{q.label}</span>
              <span className="text-[10px] text-text-disabled">({q.desc})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Output folder */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-secondary">Output Folder</label>
        <div className="flex gap-2">
          <Input
            value={outputPath}
            onChange={(e) => onOutputPathChange?.(e.target.value)}
            placeholder="/Users/.../fablr Exports"
            className="flex-1 h-8 text-xs bg-bg-tertiary border-border-subtle text-text-primary"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs text-text-secondary border-border-subtle"
          >
            <FolderOpen className="size-3.5 mr-1" />
            Browse
          </Button>
        </div>
      </div>
    </div>
  );
});

ExportSettings.displayName = 'ExportSettings';
