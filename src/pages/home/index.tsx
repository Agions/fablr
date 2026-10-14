/**
 * 剧工 (Fablr) — 控制台仪表盘 (Home Dashboard)
 * 100% 对齐 home_dashboard_ui 设计稿：黑曜石工业级剪辑工作台
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  FileText,
  Play,
  Film,
  Scissors,
  ChevronRight,
} from 'lucide-react';
import { withErrorBoundary } from '@/components/common/error-boundary';
import { useProjects } from '@/hooks/use-projects';
import { preloadProjectEditPage } from '@/core/utils/route-preload';
import styles from './index.module.less';

interface HomeProjectItem {
  id: string;
  name: string;
  subtitle: string;
  updatedAt: string;
  duration: string;
  status: '完成' | '进行中' | '排队中';
  posterBg: string;
}

const DEFAULT_POSTERS = [
  'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
  'linear-gradient(135deg, #2e1065 0%, #581c87 50%, #7e22ce 100%)',
  'linear-gradient(135deg, #022c22 0%, #065f46 50%, #059669 100%)',
  'linear-gradient(135deg, #1c1917 0%, #292524 50%, #44403c 100%)',
  'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #991b1b 100%)',
  'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
];

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { projects: sqliteProjects } = useProjects();

  const projects: HomeProjectItem[] = (sqliteProjects || []).map((p, idx) => ({
    id: p.id,
    name: p.name || `未命名项目 #${idx + 1}`,
    subtitle: 'AI 影视解说 · 智能拆条',
    updatedAt: p.updatedAt ? p.updatedAt.slice(0, 10) : '2026-08-21',
    duration: '03:30',
    status: (p.latestJob?.phase === 'rendering' ? '完成' : p.latestJob ? '进行中' : '排队中') as '完成' | '进行中' | '排队中',
    posterBg: DEFAULT_POSTERS[idx % DEFAULT_POSTERS.length],
  }));

  return (
    <div className={styles.container}>
      {/* ── 顶部 Hero 区域：AI 视频生成全流程流水线 ── */}
      <section className={styles.heroBanner}>
        <div className={styles.heroLeftCol}>
          <h2 className={styles.heroTitle}>AI 视频生成流水线</h2>
          <p className={styles.heroDesc}>
            AI Video Movie Recap 工业级创作工具，智能化影视解说、自动拆条与视听多轨合成。
          </p>
          <div className={styles.heroBtnGroup}>
            <button
              className={styles.heroPrimaryBtn}
              onClick={() => navigate('/project/new')}
              onMouseEnter={() => {
                void preloadProjectEditPage();
              }}
            >
              <Plus size={15} />
              开始生成新项目
            </button>
            <button
              className={styles.heroSecondaryBtn}
              onClick={() => navigate('/projects')}
            >
              浏览历史工程
            </button>
          </div>
        </div>

        {/* 4 阶段全链路创作工坊卡片引导 */}
        <div className={styles.pipelineFlow}>
          <div className={`${styles.flowStep} ${styles.stepActive}`} onClick={() => navigate('/asset-hub')}>
            <div className={styles.stepIconWrap}>
              <Sparkles size={18} className="text-purple-400" />
            </div>
            <span className={styles.stepLabel}>1. 素材拆条</span>
          </div>

          <ChevronRight size={14} className={styles.flowArrow} />

          <div className={`${styles.flowStep} ${styles.stepActive}`} onClick={() => navigate('/script-studio')}>
            <div className={styles.stepIconWrap}>
              <FileText size={18} className="text-cyan-400" />
            </div>
            <span className={styles.stepLabel}>2. 剧本研磨</span>
          </div>

          <ChevronRight size={14} className={styles.flowArrow} />

          <div className={`${styles.flowStep} ${styles.stepActive}`} onClick={() => navigate('/workspace')}>
            <div className={styles.stepIconWrap}>
              <Scissors size={18} className="text-teal-400" />
            </div>
            <span className={styles.stepLabel}>3. 剪辑合成</span>
          </div>

          <ChevronRight size={14} className={styles.flowArrow} />

          <div className={`${styles.flowStep} ${styles.stepActive}`} onClick={() => navigate('/export-hub')}>
            <div className={styles.stepIconWrap}>
              <Film size={18} className="text-amber-400" />
            </div>
            <span className={styles.stepLabel}>4. 消重发布</span>
          </div>
        </div>
      </section>

      {/* ── 主体双栏布局 ── */}
      <div className={styles.mainLayoutGrid}>
        {/* ── 左侧：最近项目卡片海报网格 ── */}
        <div className={styles.projectSectionCol}>
          <div className={styles.sectionHeaderRow}>
            <div className="flex items-center gap-2">
              <h3 className={styles.sectionTitle}>最近项目卡片</h3>
              <span className={styles.sectionBadge}>{projects.length} 个工程</span>
            </div>
            <button
              className={styles.viewMoreBtn}
              onClick={() => navigate('/projects')}
            >
              更多项目 <ChevronRight size={14} />
            </button>
          </div>

          {projects.length === 0 ? (
            /* 优雅空状态 */
            <div className={styles.emptyCardState}>
              <Film size={40} className={styles.emptyIcon} />
              <div className={styles.emptyTitle}>暂无创作项目</div>
              <div className={styles.emptyDesc}>
                创建您的第一个短剧解说或电影拆条工程，开启多 Agent 协同创作。
              </div>
              <button
                className={styles.emptyCreateBtn}
                onClick={() => navigate('/project/new')}
              >
                <Plus size={15} /> 立即新建项目
              </button>
            </div>
          ) : (
            /* 响应式海报卡片网格 */
            <div className={styles.projectGrid}>
              {projects.map(item => {
                const statusStyle =
                  item.status === '完成'
                    ? styles.badgeCompleted
                    : item.status === '进行中'
                      ? styles.badgeProcessing
                      : styles.badgePending;

                return (
                  <div
                    key={item.id}
                    className={styles.projectCard}
                    onClick={() => navigate(`/workspace/${item.id}`)}
                  >
                    {/* 16:9 影视级封面与悬停播放 */}
                    <div
                      className={styles.cardPoster}
                      style={{ background: item.posterBg }}
                    >
                      <span className={styles.ratioBadge}>16:9</span>
                      <div className={styles.playIconHover}>
                        <Play size={24} className="fill-white text-white ml-0.5" />
                      </div>
                    </div>

                    <div className={styles.cardInfoBody}>
                      <div className={styles.projectCardTitle}>{item.name}</div>
                      <div className={styles.cardMetaRow}>
                        <span>上次编辑: {item.updatedAt}</span>
                        <span>{item.duration}</span>
                      </div>

                      <div className={styles.cardBottomRow}>
                        <span className={`${styles.statusBadge} ${statusStyle}`}>
                          {item.status}
                        </span>
                        <div className={styles.cardQuickBtns}>
                          <button
                            type="button"
                            className={styles.quickActionBtn}
                            onClick={e => {
                              e.stopPropagation();
                              navigate(`/workspace/${item.id}`);
                            }}
                          >
                            打开
                          </button>
                          <button
                            type="button"
                            className={styles.quickActionBtn}
                            onClick={e => {
                              e.stopPropagation();
                              navigate(`/project/edit/${item.id}`);
                            }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className={styles.quickActionBtn}
                            onClick={e => {
                              e.stopPropagation();
                              navigate('/export-hub');
                            }}
                          >
                            导出
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 新建占位卡片 */}
              <div
                className={styles.newProjectPlaceholderCard}
                onClick={() => navigate('/project/new')}
              >
                <div className={styles.newPlusCircle}>
                  <Plus size={20} />
                </div>
                <span className={styles.newCardText}>新建创作项目</span>
              </div>
            </div>
          )}
        </div>

        {/* ── 右侧：渲染队列 + Token 分析面板 ── */}
        <aside className={styles.analyticsSidebar}>
          {/* 渲染队列卡片 */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <span className={styles.sideCardTitle}>渲染队列</span>
              <span className="text-xs text-text-tertiary">0 个活跃任务</span>
            </div>

            <div className="py-6 flex flex-col items-center justify-center text-center text-text-tertiary">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mb-2 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <div className="text-xs text-white/80 font-medium">渲染队列就绪</div>
              <div className="text-[10px] text-text-tertiary mt-0.5">合成任务将在此实时显示多线程进度</div>
            </div>
          </div>

          {/* Token 算力分析卡片 */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <span className={styles.sideCardTitle}>Token 算力分析</span>
              <span className="text-xs text-purple-400">本月额度充足</span>
            </div>

            <div className={styles.tokenStatBox}>
              <div className="text-xs text-text-tertiary">剩余 Tokens 额度:</div>
              <div className={styles.tokenBigNumber}>85,000</div>
              <div className="text-xs text-text-tertiary mb-2">本月已消耗: 15,000 Tokens</div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: '85%', background: 'linear-gradient(90deg, #8b5cf6, #ec4899)' }}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="text-xs font-semibold text-white/80 mb-2">生成模型使用趋势</div>
              <div className={styles.chartWaveWrap}>
                <svg className="w-full h-16" viewBox="0 0 200 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 50 Q 30 20 60 40 T 120 15 T 160 30 T 200 10 L 200 60 L 0 60 Z"
                    fill="url(#waveGradient)"
                  />
                  <path
                    d="M 0 50 Q 30 20 60 40 T 120 15 T 160 30 T 200 10"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                  />
                </svg>
                <div className={styles.chartMonthLabels}>
                  <span>1月</span>
                  <span>2月</span>
                  <span>3月</span>
                  <span>4月</span>
                  <span>5月</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default withErrorBoundary(Home, { name: 'Home' });
