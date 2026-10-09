import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonitorPlayerPanel } from './monitor-player-panel';
import type { MediaSourceItem } from '../types';

vi.mock('@/shared', () => ({
  notify: {
    info: vi.fn(),
  },
}));

describe('MonitorPlayerPanel', () => {
  const mockSource: MediaSourceItem = {
    id: 'src_1',
    name: '主镜头_01.mp4',
    duration: '02:30',
    type: 'video',
  };

  it('renders standby state when activeSource is null', () => {
    render(
      <MonitorPlayerPanel
        activeSource={null}
        isPlaying={false}
        onTogglePlay={vi.fn()}
      />
    );

    expect(screen.getByText('实时监看')).toBeInTheDocument();
    expect(screen.getByText('监看视口待命')).toBeInTheDocument();
  });

  it('renders active source playback overlay', () => {
    render(
      <MonitorPlayerPanel
        activeSource={mockSource}
        isPlaying={false}
        onTogglePlay={vi.fn()}
      />
    );

    expect(screen.getByText(/当前正在实时回放已编排的 5 轨视听对齐片段/)).toBeInTheDocument();
  });

  it('toggles playback when play button is clicked', () => {
    const handleTogglePlay = vi.fn();
    const { rerender } = render(
      <MonitorPlayerPanel
        activeSource={mockSource}
        isPlaying={false}
        onTogglePlay={handleTogglePlay}
      />
    );

    // Click play (middle button)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(handleTogglePlay).toHaveBeenCalledTimes(1);

    rerender(
      <MonitorPlayerPanel
        activeSource={mockSource}
        isPlaying={true}
        onTogglePlay={handleTogglePlay}
      />
    );
  });
});
