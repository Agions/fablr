import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SourceLibraryPanel } from './source-library-panel';
import type { MediaSourceItem } from '../types';

describe('SourceLibraryPanel', () => {
  const mockSources: MediaSourceItem[] = [
    { id: 'src_1', name: '预告片.mp4', duration: '01:30', type: 'video' },
    { id: 'src_2', name: '配乐.mp3', duration: '03:15', type: 'audio' },
  ];

  it('renders empty state when no sources are provided', () => {
    render(
      <SourceLibraryPanel
        sources={[]}
        activeSource={null}
        onSelectSource={vi.fn()}
        onFileUpload={vi.fn()}
      />
    );

    expect(screen.getByText('素材列表为空')).toBeInTheDocument();
    expect(screen.getByText('导入视听文件')).toBeInTheDocument();
  });

  it('renders source items and selects active source', () => {
    const handleSelect = vi.fn();
    render(
      <SourceLibraryPanel
        sources={mockSources}
        activeSource={mockSources[0]}
        onSelectSource={handleSelect}
        onFileUpload={vi.fn()}
      />
    );

    expect(screen.getByText('预告片.mp4')).toBeInTheDocument();
    expect(screen.getByText('配乐.mp3')).toBeInTheDocument();

    fireEvent.click(screen.getByText('配乐.mp3'));
    expect(handleSelect).toHaveBeenCalledWith('src_2');
  });

  it('triggers onFileUpload when input file changes', () => {
    const handleUpload = vi.fn();
    const { container } = render(
      <SourceLibraryPanel
        sources={mockSources}
        activeSource={mockSources[0]}
        onSelectSource={vi.fn()}
        onFileUpload={handleUpload}
      />
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(['dummy'], 'test.mp4', { type: 'video/mp4' });
    if (input) {
      fireEvent.change(input, { target: { files: [file] } });
    }

    expect(handleUpload).toHaveBeenCalledTimes(1);
  });
});
