import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkshopNavHeader } from './workshop-nav-header';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('WorkshopNavHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders default title and badge when no projectTitle is provided', () => {
    render(
      <WorkshopNavHeader
        viewMode="script"
        onViewModeChange={vi.fn()}
      />
    );

    expect(screen.getByText('剧工 Fablr · 专业视听剪辑工作台')).toBeInTheDocument();
    expect(screen.getByText('5 轨智能合成')).toBeInTheDocument();
  });

  it('renders project title when projectTitle is provided', () => {
    render(
      <WorkshopNavHeader
        projectId="proj_test_1"
        projectTitle="测试项目名称"
        viewMode="script"
        onViewModeChange={vi.fn()}
      />
    );

    expect(screen.getByText('剧工 Fablr · 测试项目名称')).toBeInTheDocument();
  });

  it('navigates to asset-hub when step 1 is clicked', () => {
    render(
      <WorkshopNavHeader
        projectId="proj_101"
        viewMode="script"
        onViewModeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('1. 素材拆条'));
    expect(mockNavigate).toHaveBeenCalledWith('/asset-hub/proj_101');
  });

  it('navigates to script-studio when step 2 is clicked', () => {
    render(
      <WorkshopNavHeader
        projectId="proj_101"
        viewMode="script"
        onViewModeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('2. 剧本研磨'));
    expect(mockNavigate).toHaveBeenCalledWith('/script-studio/proj_101');
  });

  it('navigates to export-hub when step 4 or entry button is clicked', () => {
    render(
      <WorkshopNavHeader
        projectId="proj_101"
        viewMode="script"
        onViewModeChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('4. 消重发布'));
    expect(mockNavigate).toHaveBeenCalledWith('/export-hub/proj_101');

    fireEvent.click(screen.getByText('进入消重发布 →'));
    expect(mockNavigate).toHaveBeenCalledWith('/export-hub/proj_101');
  });

  it('calls onViewModeChange when switching view modes', () => {
    const handleViewModeChange = vi.fn();
    render(
      <WorkshopNavHeader
        projectId="proj_101"
        viewMode="script"
        onViewModeChange={handleViewModeChange}
      />
    );

    fireEvent.click(screen.getByText('时间轴视图'));
    expect(handleViewModeChange).toHaveBeenCalledWith('timeline');

    fireEvent.click(screen.getByText('剧本视图'));
    expect(handleViewModeChange).toHaveBeenCalledWith('script');
  });
});
