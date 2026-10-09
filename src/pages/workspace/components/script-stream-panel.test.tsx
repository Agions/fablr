import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScriptStreamPanel } from './script-stream-panel';
import type { ScriptTimelineBlock } from '../types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ScriptStreamPanel', () => {
  const mockBlocks: ScriptTimelineBlock[] = [
    {
      id: 'block_1',
      type: 'hook',
      label: '黄金3秒 Hook',
      text: '开篇第一句话抓人眼球',
      durationSec: 5,
      linkedClipName: '镜头01',
      color: '#a855f7',
    },
    {
      id: 'block_2',
      type: 'climax',
      label: '高潮反转',
      text: '真相大白，所有人震惊',
      durationSec: 15,
      linkedClipName: '镜头02',
      color: '#f59e0b',
    },
  ];

  it('renders empty state when no script blocks are provided', () => {
    render(
      <ScriptStreamPanel
        projectId="proj_test"
        scriptBlocks={[]}
        activeSource={null}
        isPlaying={false}
        isGenerating={false}
        onTogglePlay={vi.fn()}
        onStartAiGen={vi.fn()}
      />
    );

    expect(screen.getByText('暂无剧本数据')).toBeInTheDocument();
    expect(screen.getByText('去剧本研磨工坊')).toBeInTheDocument();
    expect(screen.getByText('AI 一键合成示例剧本')).toBeInTheDocument();
  });

  it('navigates to script studio on button click', () => {
    render(
      <ScriptStreamPanel
        projectId="proj_test"
        scriptBlocks={[]}
        activeSource={null}
        isPlaying={false}
        isGenerating={false}
        onTogglePlay={vi.fn()}
        onStartAiGen={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('去剧本研磨工坊'));
    expect(mockNavigate).toHaveBeenCalledWith('/script-studio/proj_test');
  });

  it('renders script blocks when provided', () => {
    render(
      <ScriptStreamPanel
        projectId="proj_test"
        scriptBlocks={mockBlocks}
        activeSource={null}
        isPlaying={false}
        isGenerating={false}
        onTogglePlay={vi.fn()}
        onStartAiGen={vi.fn()}
      />
    );

    expect(screen.getByText('黄金3秒 Hook')).toBeInTheDocument();
    expect(screen.getByText('开篇第一句话抓人眼球')).toBeInTheDocument();
    expect(screen.getByText('高潮反转')).toBeInTheDocument();
    expect(screen.getByText('真相大白，所有人震惊')).toBeInTheDocument();
    expect(screen.getByText('● 已与时间轴对齐')).toBeInTheDocument();
  });

  it('toggles playback when mini monitor play button is clicked', () => {
    const handleTogglePlay = vi.fn();
    render(
      <ScriptStreamPanel
        projectId="proj_test"
        scriptBlocks={mockBlocks}
        activeSource={null}
        isPlaying={false}
        isGenerating={false}
        onTogglePlay={handleTogglePlay}
        onStartAiGen={vi.fn()}
      />
    );

    const playBtn = screen.getByText('播放预览');
    fireEvent.click(playBtn);
    expect(handleTogglePlay).toHaveBeenCalledTimes(1);
  });
});
