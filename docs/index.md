---
layout: home

hero:
  name: Fablr (剧工)
  text: 开源桌面级 AI 影视/短剧解说创作工坊
  tagline: Tauri 2 + Rust + React 18 · 本地优先 · 100% 隐私安全 · 全链路工业级自动化
  image:
    src: /favicon.svg
    alt: Fablr
  actions:
    - theme: brand
      text: 快速开始 (5分钟实战)
      link: /getting-started/03-quick-start
    - theme: alt
      text: 4 大核心工坊 SOP
      link: /workshops/01-asset-hub
    - theme: alt
      text: 架构与技术原理
      link: /architecture/01-system-overview

features:
  - title: 🎬 智能素材拆条 (Asset Hub)
    details: 本地 Whisper 极速语音转写，自动探测视觉镜头边界、情感爆点与台词情感色彩，秒级切片归类。
  - title: 🤖 多 Agent 剧本研磨 (Script Studio)
    details: 4 段式工业级剧本骨架（黄金3秒Hook/主线递进/高潮反转/互动结尾），流式多 Agent 研磨与 TTS 时长毫秒级预估。
  - title: 🎛️ 5 轨视听剪辑工作台 (Workspace)
    details: Canvas + RAF 硬件加速虚拟化时间轴，支持以文剪片、波形可视化与 V1/V2/A1/A2/A3 专业五轨混流。
  - title: 🛡️ 5 级消重矩阵与剪映草稿导出 (Export Hub)
    details: 镜像翻转、微调变速、动态噪点、画中画光影与智能抽帧，逆向直接导出原生剪映草稿工程 (draft_content.json)。
  - title: ⚡ 极致性能与轻量体验
    details: Tauri 2 架构驱动，安装包仅约 15MB，运行时内存仅 ~60MB，冷启动 < 400ms，性能比传统 Electron 提升 400%。
  - title: 🔒 100% 本地优先与隐私合规
    details: 视频、字幕、音频文件与项目数据均持久化在本地 SQLite 与磁盘，无需云端中转，零数据泄露风险。
---

## 🏗️ 工业级系统全景图

```mermaid
graph TD
    classDef client fill:#18192a,stroke:#8b5cf6,stroke-width:2px,color:#fff;
    classDef core fill:#111220,stroke:#06b6d4,stroke-width:2px,color:#fff;
    classDef native fill:#0e0f1a,stroke:#10b981,stroke-width:2px,color:#fff;

    subgraph 前端与工坊工作流 [React 18 + Zustand + CSS Modules]
        AH[1. 素材拆条工坊 Asset Hub]:::client --> SS[2. 剧本研磨工坊 Script Studio]:::client
        SS --> WS[3. 5轨剪辑工作台 Workspace]:::client
        WS --> EH[4. 消重发布工坊 Export Hub]:::client
    end

    subgraph 核心服务与驱动 [src/core & src/shared]
        AFD[AtomicProjectFileDriver 原子防竞态持久化]:::core
        MAP[Multi-Agent Drama Pipeline]:::core
        US[UpdaterService 智能版本检测]:::core
    end

    subgraph 宿主与原生引擎 [Tauri 2 + Rust + 本地 AI]
        RUST[Tauri IPC / SQLite / 资源池治理]:::native
        FFMPEG[FFmpeg 硬件编解码 & 音画混流]:::native
        WHISPER[faster-whisper 本地语音识别]:::native
        DRAFT[剪映草稿逆向引擎 CapCut Draft Engine]:::native
    end

    AH -.-> AFD
    SS -.-> MAP
    WS -.-> RUST
    EH -.-> DRAFT
    AFD --> RUST
    MAP --> RUST
    RUST --> FFMPEG
    RUST --> WHISPER
```

## 📊 技术栈选型矩阵

| 层级 | 核心技术 | 架构定位与选型考量 |
| :--- | :--- | :--- |
| **桌面运行时** | **Tauri 2 + Rust** | 原生轻量化容器，安装包仅 ~15MB，内存占用极低，跨 macOS/Windows/Linux 统一。 |
| **前端应用** | **React 18 + Vite** | 组件化高度解耦，Zustand 状态机，CSS Modules 黑曜石工业风。 |
| **工程架构** | **模块化分层 (Modular Clean Architecture)** | `src/types` (全域类型契约) + `src/shared` (共享工具) + `src/core` (领域核心服务) + `src/components` (组件)。 |
| **音视频与 AI** | **FFmpeg + faster-whisper** | 本地硬件加速编解码、ASR 离线转写，多 Agent 大模型流式剧本研磨。 |
| **草稿与分发** | **CapCut Draft Reverse** | 逆向直接生成剪映全轨工程与 5 级消重参数，1 秒无损导入二次精剪。 |

[🚀 立即开始 5 分钟极速实战 →](/getting-started/03-quick-start)
