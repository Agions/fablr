/**
 * 剧工 (Fablr) — 在线文档中心数据源
 */
import doc01 from '../../../docs/01-ARCHITECTURE.md?raw';
import doc02 from '../../../docs/02-MULTI_AGENT_STUDIO.md?raw';
import doc03 from '../../../docs/03-JIANYING_AND_DEDUP.md?raw';
import doc04 from '../../../docs/04-RUST_BACKEND_DDD.md?raw';
import doc05 from '../../../docs/05-GETTING_STARTED.md?raw';
import docNaming from '../../../docs/NAMING_AND_MODULARIZATION.md?raw';
import docOverview from '../../../docs/README.md?raw';
import docManual from '../../../docs/dist-manual/USER_MANUAL.md?raw';

export interface DocItem {
  id: string;
  slug: string;
  title: string;
  category: '系统架构' | '核心流水线' | '开发与规范';
  description: string;
  iconName: 'Layers' | 'Sparkles' | 'Share2' | 'Database' | 'Terminal' | 'Shield' | 'BookOpen';
  content: string;
  readTime: string;
  lastUpdated: string;
}

export const DOCS_REGISTRY: DocItem[] = [
  {
    id: 'user-manual',
    slug: 'user-manual',
    title: '桌面端用户使用手册',
    category: '开发与规范',
    description: '客户端 4 步极速上手指南、工坊工作流与常用快捷键一览',
    iconName: 'BookOpen',
    content: docManual,
    readTime: '5 分钟',
    lastUpdated: '2026-10-08',
  },
  {
    id: 'overview',
    slug: 'overview',
    title: '官方技术文档总览',
    category: '系统架构',
    description: '剧工 (Fablr) 核心架构与开发文档体系索引',
    iconName: 'BookOpen',
    content: docOverview,
    readTime: '2 分钟',
    lastUpdated: '2026-08-20',
  },
  {
    id: '01-architecture',
    slug: '01-architecture',
    title: '系统架构与核心设计',
    category: '系统架构',
    description: '前端表现层、服务层与 Rust Tauri 2 后端三层系统设计',
    iconName: 'Layers',
    content: doc01,
    readTime: '6 分钟',
    lastUpdated: '2026-08-20',
  },
  {
    id: '02-multi-agent-studio',
    slug: '02-multi-agent-studio',
    title: '多 Agent 剧本研磨工坊',
    category: '核心流水线',
    description: '人物小传解构、前 3 秒黄金 Hook 与双栏分镜台词对齐',
    iconName: 'Sparkles',
    content: doc02,
    readTime: '5 分钟',
    lastUpdated: '2026-08-20',
  },
  {
    id: '03-jianying-and-dedup',
    slug: '03-jianying-and-dedup',
    title: '剪映草稿协议与 5 级消重',
    category: '核心流水线',
    description: '剪映草稿导出器与 5 级反爬指纹消重滤镜链设计',
    iconName: 'Share2',
    content: doc03,
    readTime: '7 分钟',
    lastUpdated: '2026-08-20',
  },
  {
    id: '04-rust-backend-ddd',
    slug: '04-rust-backend-ddd',
    title: 'Rust 后端与 DDD 领域仓储',
    category: '系统架构',
    description: 'Rust Tauri 2 后端与 SQLite DDD 6 大领域驱动仓储架构',
    iconName: 'Database',
    content: doc04,
    readTime: '8 分钟',
    lastUpdated: '2026-08-20',
  },
  {
    id: '05-getting-started',
    slug: '05-getting-started',
    title: '开发者快速上手与质量验证',
    category: '开发与规范',
    description: '本地环境搭建、前后端运行与全量自动化校验命令',
    iconName: 'Terminal',
    content: doc05,
    readTime: '4 分钟',
    lastUpdated: '2026-08-20',
  },
  {
    id: 'naming-and-modularization',
    slug: 'naming-and-modularization',
    title: '架构命名与代码整洁规范',
    category: '开发与规范',
    description: 'KISS 极简命名规范、纯小写 kebab-case 与零代码冗余准则',
    iconName: 'Shield',
    content: docNaming,
    readTime: '5 分钟',
    lastUpdated: '2026-08-20',
  },
];
