import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MultiTrackTimeline } from './multi-track-timeline';
import type { MediaSourceItem } from '../types';

describe('MultiTrackTimeline', () => {
  const mockSource: MediaSourceItem = {
    id: 'src_1',
    name: '测试镜头_01.mp4',
    duration: '03:30',
    type: 'video',
  };

  it('renders all 5 tracks correctly', () => {
    render(
      <MultiTrackTimeline
        activeSource={mockSource}
        zoomLevel={50}
        onZoomChange={vi.fn()}
        onExportJianying={vi.fn()}
      />
    );

    expect(screen.getByText('主视频轨')).toBeInTheDocument();
    expect(screen.getByText('AI 空镜轨')).toBeInTheDocument();
    expect(screen.getByText('人声解说 TTS')).toBeInTheDocument();
    expect(screen.getByText('背景音乐 BGM')).toBeInTheDocument();
    expect(screen.getByText('动作音效 FX')).toBeInTheDocument();
  });

  it('renders timecode and tool buttons', () => {
    render(
      <MultiTrackTimeline
        activeSource={mockSource}
        zoomLevel={50}
        onZoomChange={vi.fn()}
        onExportJianying={vi.fn()}
      />
    );

    expect(screen.getByText('00:00:15:18')).toBeInTheDocument();
    expect(screen.getByTitle('撤销 (Cmd+Z)')).toBeInTheDocument();
    expect(screen.getByTitle('重做 (Cmd+Shift+Z)')).toBeInTheDocument();
    expect(screen.getByTitle('剃刀切割工具 (C)')).toBeInTheDocument();
  });

  it('calls onExportJianying when export button is clicked', () => {
    const handleExport = vi.fn();
    render(
      <MultiTrackTimeline
        activeSource={mockSource}
        zoomLevel={50}
        onZoomChange={vi.fn()}
        onExportJianying={handleExport}
      />
    );

    fireEvent.click(screen.getByText('导出剪映工程'));
    expect(handleExport).toHaveBeenCalledTimes(1);
  });

  it('handles zoom level changes', () => {
    const handleZoom = vi.fn();
    render(
      <MultiTrackTimeline
        activeSource={mockSource}
        zoomLevel={50}
        onZoomChange={handleZoom}
        onExportJianying={vi.fn()}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75' } });
    expect(handleZoom).toHaveBeenCalledWith(75);
  });
});
