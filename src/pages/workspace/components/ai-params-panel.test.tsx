import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AiParamsPanel } from './ai-params-panel';

describe('AiParamsPanel', () => {
  it('renders all configuration fields and select options', () => {
    render(
      <AiParamsPanel
        styleMode="fast_recap"
        speaker="teacher_wang"
        bgmGenre="suspense"
        isGenerating={false}
        onStyleModeChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onBgmGenreChange={vi.fn()}
        onStartAiGen={vi.fn()}
      />
    );

    expect(screen.getByText('AI 视听智能剪辑配置')).toBeInTheDocument();
    expect(screen.getByText('剪辑叙事风格')).toBeInTheDocument();
    expect(screen.getByText('解说音色 (TTS)')).toBeInTheDocument();
    expect(screen.getByText('背景配乐 (BGM)')).toBeInTheDocument();
    expect(screen.getByText('一键 AI 5 轨智能合成')).toBeInTheDocument();
  });

  it('triggers change callbacks when selecting different options', () => {
    const handleStyleChange = vi.fn();
    const handleSpeakerChange = vi.fn();
    const handleBgmChange = vi.fn();

    render(
      <AiParamsPanel
        styleMode="fast_recap"
        speaker="teacher_wang"
        bgmGenre="suspense"
        isGenerating={false}
        onStyleModeChange={handleStyleChange}
        onSpeakerChange={handleSpeakerChange}
        onBgmGenreChange={handleBgmChange}
        onStartAiGen={vi.fn()}
      />
    );

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'suspense' } });
    expect(handleStyleChange).toHaveBeenCalledWith('suspense');

    fireEvent.change(selects[1], { target: { value: 'yunxi' } });
    expect(handleSpeakerChange).toHaveBeenCalledWith('yunxi');

    fireEvent.change(selects[2], { target: { value: 'cyber' } });
    expect(handleBgmChange).toHaveBeenCalledWith('cyber');
  });

  it('handles generating state and triggers onStartAiGen', () => {
    const handleStartAiGen = vi.fn();
    const { rerender } = render(
      <AiParamsPanel
        styleMode="fast_recap"
        speaker="teacher_wang"
        bgmGenre="suspense"
        isGenerating={false}
        onStyleModeChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onBgmGenreChange={vi.fn()}
        onStartAiGen={handleStartAiGen}
      />
    );

    const btn = screen.getByText('一键 AI 5 轨智能合成');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(handleStartAiGen).toHaveBeenCalledTimes(1);

    rerender(
      <AiParamsPanel
        styleMode="fast_recap"
        speaker="teacher_wang"
        bgmGenre="suspense"
        isGenerating={true}
        onStyleModeChange={vi.fn()}
        onSpeakerChange={vi.fn()}
        onBgmGenreChange={vi.fn()}
        onStartAiGen={handleStartAiGen}
      />
    );

    expect(screen.getByText('正在智能合成中...')).toBeDisabled();
  });
});
