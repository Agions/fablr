import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceStudioPage } from './index';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'test_project_123' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/core/services/project/project-file-service', () => ({
  loadProjectWithRetry: vi.fn().mockResolvedValue({
    id: 'test_project_123',
    name: '测试短剧项目',
  }),
}));

vi.mock('@/core/exporters/jianying-exporter', () => ({
  exportJianYingDraft: vi.fn().mockResolvedValue({
    success: true,
    filePath: '/tmp/draft_content.json',
  }),
}));

vi.mock('@/shared', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('WorkspaceStudioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts cleanly and displays script view mode by default', async () => {
    render(<WorkspaceStudioPage />);

    // Header rendered
    expect(screen.getByText(/5 轨智能合成/)).toBeInTheDocument();
    // Default script view mode buttons
    expect(screen.getByText('剧本视图')).toBeInTheDocument();
    expect(screen.getByText('时间轴视图')).toBeInTheDocument();
  });

  it('switches between script view and timeline view', async () => {
    render(<WorkspaceStudioPage />);

    // Click timeline view button
    fireEvent.click(screen.getByText('时间轴视图'));

    // Timeline view 5-track timeline and 3-column grid should be in document
    expect(screen.getByText('主视频轨')).toBeInTheDocument();
    expect(screen.getByText('背景音乐 BGM')).toBeInTheDocument();
    expect(screen.getByText('AI 空镜轨')).toBeInTheDocument();

    // Switch back to script view
    fireEvent.click(screen.getByText('剧本视图'));
    expect(screen.queryByText('主视频轨')).not.toBeInTheDocument();
  });
});
