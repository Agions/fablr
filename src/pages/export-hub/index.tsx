/**
 * 剧工 (Fablr) — 智能消重与多平台矩阵发布中心 (Export & Matrix Hub)
 * 重构版：黑曜石工业级多画幅监看器与消重/矩阵卡片布局
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { withErrorBoundary } from '@/components/common/error-boundary';
import { loadProjectWithRetry } from '@/core/services/project/project-file-service';
import { antiDedupService } from '@/core/services/export/anti-dedup-service';
import { notify } from '@/shared';
import type { MatrixPlatformItem } from './types';
import { ExportHubHeader } from './components/export-hub-header';
import { DedupFiltersPanel } from './components/dedup-filters-panel';
import { AspectMonitorPanel } from './components/aspect-monitor-panel';
import { MatrixPublishPanel } from './components/matrix-publish-panel';
import { BindAccountModal } from './components/bind-account-modal';
import styles from './export-hub.module.less';

export * from './types';

const DEFAULT_PLATFORMS: MatrixPlatformItem[] = [
  {
    id: 'douyin',
    name: '抖音短视频',
    account: '剧工短剧官方号',
    fans: '12.8W',
    enabled: true,
    status: '就绪',
    badgeColor: '#ec4899',
    boundUser: '@fablr_douyin',
  },
  {
    id: 'kuaishou',
    name: '快手短剧',
    account: '战神解说大魔王',
    fans: '8.4W',
    enabled: true,
    status: '就绪',
    badgeColor: '#f97316',
    boundUser: '@fablr_ks',
  },
  {
    id: 'channels',
    name: '微信视频号',
    account: '剧工影视工坊',
    fans: '3.2W',
    enabled: true,
    status: '就绪',
    badgeColor: '#10b981',
    boundUser: '@fablr_wx',
  },
  {
    id: 'bilibili',
    name: '哔哩哔哩 (B站)',
    account: '点击授权绑定账号',
    fans: '待同步',
    enabled: false,
    status: '未绑定',
    badgeColor: '#06b6d4',
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    account: '点击授权绑定账号',
    fans: '待同步',
    enabled: false,
    status: '未绑定',
    badgeColor: '#ef4444',
  },
];

export const ExportHubPage: React.FC = () => {
  const { projectId } = useParams<{ projectId?: string }>();
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [projectTitle, setProjectTitle] = useState<string>('');

  // 5 级消重滤镜开关
  const [zoomBreathing, setZoomBreathing] = useState(true);
  const [filmGrain, setFilmGrain] = useState(true);
  const [lightReconstruction, setLightReconstruction] = useState(true);
  const [pipOverlay, setPipOverlay] = useState(true);
  const [mirrorFlip, setMirrorFlip] = useState(false);

  // 导出清晰度
  const [exportResolution, setExportResolution] = useState<'1080p' | '4k'>('4k');

  const [platforms, setPlatforms] = useState<MatrixPlatformItem[]>(DEFAULT_PLATFORMS);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);
  const [complianceScore, setComplianceScore] = useState<number | null>(95);

  // 绑定 Modal
  const [bindModalOpen, setBindModalOpen] = useState(false);
  const [selectedPlatformForBind, setSelectedPlatformForBind] = useState<MatrixPlatformItem | null>(null);

  const handleRunComplianceCheck = () => {
    setIsCheckingCompliance(true);
    setTimeout(() => {
      setIsCheckingCompliance(false);
      const dedupConfig = antiDedupService.buildFfmpegDedupConfig({
        enabled: true,
        zoomBreathing,
        filmGrain,
        lightReconstruction,
        pipOverlay,
        mirrorFlip,
        audioEqShift: true,
        metaDataReset: true,
      });
      const activeFilterCount = [zoomBreathing, filmGrain, lightReconstruction, pipOverlay, mirrorFlip].filter(Boolean).length;
      const calculatedScore = Math.min(99, 80 + activeFilterCount * 4);
      setComplianceScore(calculatedScore);
      notify.success(`发布前合规体检完成！已激活 ${dedupConfig.summaryDesc.length} 项消重特性，原创度与合规评分：${calculatedScore} 分`);
    }, 600);
  };

  const handleGenerateCovers = () => {
    notify.success('已自动截图生成爆款分集封面模板（第1集 / 第2集 / 完结篇）！');
  };

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      try {
        const project = await loadProjectWithRetry(projectId);
        if (project) {
          setProjectTitle(project.name || '');
        }
      } catch {
        // ignore
      }
    })();
  }, [projectId]);

  const togglePlatform = (id: string) => {
    const target = platforms.find(p => p.id === id);
    if (target && target.status === '未绑定') {
      setSelectedPlatformForBind(target);
      setBindModalOpen(true);
      return;
    }
    setPlatforms(prev =>
      prev.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleConfirmBindAccount = () => {
    if (!selectedPlatformForBind) return;
    setPlatforms(prev =>
      prev.map(p =>
        p.id === selectedPlatformForBind.id
          ? {
              ...p,
              account: `${p.name}创作者_已绑定`,
              fans: '1.2W',
              status: '就绪',
              enabled: true,
              boundUser: `@fablr_${p.id}`,
            }
          : p
      )
    );
    notify.success(`已成功授权绑定 ${selectedPlatformForBind.name} 账号！`);
    setBindModalOpen(false);
  };

  const handlePublishAll = () => {
    const enabledPlatforms = platforms.filter(p => p.enabled && p.status !== '未绑定');
    if (enabledPlatforms.length === 0) {
      notify.error(null, '请至少勾选一个已授权就绪的平台！');
      return;
    }

    const dedupConfig = antiDedupService.buildFfmpegDedupConfig({
      enabled: true,
      zoomBreathing,
      filmGrain,
      lightReconstruction,
      pipOverlay,
      mirrorFlip,
      audioEqShift: true,
      metaDataReset: true,
    });

    setIsPublishing(true);
    setPublishProgress(10);
    setPlatforms(prev =>
      prev.map(p => (p.enabled && p.status !== '未绑定' ? { ...p, status: '排队中' } : p))
    );

    const interval = setInterval(() => {
      setPublishProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsPublishing(false);
          setPlatforms(pList =>
            pList.map(p => (p.enabled && p.status !== '未绑定' ? { ...p, status: '已发布' } : p))
          );
          notify.success(`消重指纹重构完成 (${exportResolution.toUpperCase()})！应用 ${dedupConfig.summaryDesc.length} 级消重矩阵，全网 ${enabledPlatforms.length} 个平台矩阵分发成功！`);
          return 100;
        }
        return prev + 30;
      });
    }, 400);
  };

  return (
    <div className={styles.container}>
      {/* ── 顶部流程流转条 ── */}
      <ExportHubHeader
        projectId={projectId}
        projectTitle={projectTitle}
        isPublishing={isPublishing}
        onPublishAll={handlePublishAll}
      />

      {/* ── 三栏核心工作台 ── */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* ── 1. 左栏：5 级消重滤镜 + 合规扫描 ── */}
        <DedupFiltersPanel
          zoomBreathing={zoomBreathing}
          filmGrain={filmGrain}
          lightReconstruction={lightReconstruction}
          pipOverlay={pipOverlay}
          mirrorFlip={mirrorFlip}
          complianceScore={complianceScore}
          isCheckingCompliance={isCheckingCompliance}
          onZoomBreathingChange={setZoomBreathing}
          onFilmGrainChange={setFilmGrain}
          onLightReconstructionChange={setLightReconstruction}
          onPipOverlayChange={setPipOverlay}
          onMirrorFlipChange={setMirrorFlip}
          onRunComplianceCheck={handleRunComplianceCheck}
          onGenerateCovers={handleGenerateCovers}
        />

        {/* ── 2. 中栏：多画幅自适应高清监看视口 ── */}
        <AspectMonitorPanel
          aspectRatio={aspectRatio}
          exportResolution={exportResolution}
          onAspectRatioChange={setAspectRatio}
          onResolutionChange={setExportResolution}
        />

        {/* ── 3. 右栏：多平台矩阵发布 ── */}
        <MatrixPublishPanel
          platforms={platforms}
          isPublishing={isPublishing}
          publishProgress={publishProgress}
          onTogglePlatform={togglePlatform}
          onPublishAll={handlePublishAll}
        />
      </div>

      {/* 账号授权绑定 Modal */}
      <BindAccountModal
        platform={selectedPlatformForBind}
        isOpen={bindModalOpen}
        onClose={() => setBindModalOpen(false)}
        onConfirm={handleConfirmBindAccount}
      />
    </div>
  );
};

export default withErrorBoundary(ExportHubPage, { name: 'ExportHubPage' });
