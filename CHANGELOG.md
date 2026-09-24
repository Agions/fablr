## [Unreleased]

### 📝 Docs

- **README.md 重写**（commit `69363cda`）：口径校准 10 LLM Provider（openai / anthropic / google / alibaba-qwen / zhipu / iflytek / deepseek / moonshot / local / custom，验证自 `src/core/config/ai-models/providers.ts`）；分离 "这是什么 / 特性 / 快速开始 / 架构 / 目录" 5 大段；文档导航拆为用户指南 / 开发文档 / 参考 3 组。
- **8 个不规范的文档删除**（commit `edd3d715`，共 1025 行）：`REFACTORING_REPORT.md`（0609 残留,描述从未落地的 visionService 拆分）、`docs/CHANGELOG.md`（与根 CHANGELOG 重复）、`docs/dev/architecture-optimization.md`（5 个 pain point + 3 个 ADR 全部已实现,文档是"未来计划"非"实现记录"）、`docs/dev/backend.md` / `docs/dev/frontend.md`（与 architecture.md 100% 重叠）、`docs/dev/commentary-workflow.md` / `director-agent.md` / `script-generation.md`（三处讲同一 5 步 Pipeline,合并为 commentary.md）。所有 8 个文件 `rg -l <name>` 零引用,安全删除。
- **`docs/dev/architecture.md` 重写 + `docs/dev/commentary.md` 新建**（commit `d93ae770`）：architecture.md 94 → 305 行补全 v2.2.0 真实状态（10 LLM Provider / 61 个 Tauri 命令 / 双服务层 ADR-101 / 5 步 Pipeline ADR-103 / 18 组件 useState→useReducer 状态机迁移 / 9 个路由页面 / 5 个 Zustand store / 14 个 core/services 子模块 / Rust 端 commands/ commentary 3 子目录 + render 2 子目录 / 3 个 Rust 集成测试 / FABLR_/CUTDECK_ 双前缀环境变量）；commentary.md 新建 286 行整合 3 文件——5 步 Pipeline 状态机、6 阶段 Director 状态机、10 Provider Prompt 模板、5 风格质量检查、5 分钟视频性能/成本表。
- **`docs/.vitepress/config.ts` 同步**（commit `f5f96938`）：sidebar 删 6 个 dead link（指向已删文件），"解说工作流" 指向新 commentary.md，"系统架构" 标题同步。
- **2 处死链修复**（commit `aa870e60`）：`src/store/README.md` + `src/services/README.md` 引用已删 `architecture-optimization.md`，重定向到 `architecture.md §双服务层 (ADR-101)`。
- **CHANGELOG 勘误**（commit `d93ae770` 当日 tree 即如此，非 post-refactor drift）：v2.2.0 [Unreleased] L7 + 同 commit message 描述 "14 个 core/services 子模块" 应为 **13 个**（实为 ai/aiClip/asr/auth/commentary/editor/export/file/pipeline/project/providers/subtitle/video；"配置存储" 实为 `editor/storage.ts` 文件而非独立 `storage/` 子目录）。本次 audit (2026-06-29) 通过 `git show d93ae770:src/core/services/` 直接验证。历史 L7 数字按 pitfall #21 保留不修, 勘误条作为"v2.2.0 当天 tree 真相记录"。

### 🚀 New Features

#### P1 — 智能片段速度推荐
- **Rust `smart_segmenter.rs`**：每个 `VideoSegment` 新增 `suggested_speed: Option<f64>` 字段（1.0–6.0x）
- **速度推导算法**：基于 `avg_energy / mean_energy` 比率，分为四档 — <0.5→6x（空白），0.5–0.85→4x（低能量），0.85–1.1→2x（正常），>1.1→1x（高光）
- **短片段保护**：不足 3 秒的片段强制 1.0x，避免加速导致内容丢失
- **TypeScript 类型**：`SmartVideoSegment` 新增 `suggestedSpeed?: number`

#### P1 — 自动转场建议
- **Rust `smart_segmenter.rs`**：`VideoSegment` 新增 `suggested_transition: Option<String>`
- **30+ 规则矩阵**：`src/core/services/video/transition-suggestion.ts`（新建）
  - 场景切换→dissolve/glitch，动作片段→wipe/slide，对话→fade/dissolve，静默→fade
  - 按片段类型 × 前后衔接 × 时长 × 内容密度综合打分

#### P1 — 批量多视频处理
- **`VideoProcessingController.tsx`**：`addBatchItem` 自动记录各批次项视频路径
- **`processVideo`**：支持可选 `itemVideoPath` 参数，批量时使用各批次项独立路径

#### P2 — TTS 配音混音
- **Rust `video_processor.rs`**：新增 `mix_audio` + `get_audio_duration` 命令
  - `mix_audio`：FFmpeg `filter_complex` 混音，原音轨 volume=0.3 背景音，TTS 配音 volume=1.0 覆盖
  - `get_audio_duration`：返回音频文件时长（秒）
- **`audio-mix.service.ts`**（新建）：`mixTtsWithVideo()` + `getAudioDuration()` 前端封装
- **`VideoComposing.tsx`**：`handleSynthesize` 集成混音流程
- **`handleGenerateVoice`**：配音进度真实回调（`voiceSynthesisService.synthesize()` 第三参数 `onProgress`）

### 🐛 Bug Fixes

- **`AIVideoPreview.tsx` 键盘监听器重绑定**：播放/暂停时 `useEffect` deps 含 `state.isPlaying` 导致每帧重绑键盘监听器 → 改用 `isPlayingRef`，deps 从 5 缩减为 1（`[currentVideo]`）
- **`FablrProvider.tsx` context value 爆炸**：所有 consumer 每次 dispatch 都重渲染 → `canProceed` 依赖精确到 `state.currentStep + state.stepStatus`
- **`ScriptWriting.tsx` useEffect TDZL**：`lastTimeoutIdRef` 在 cleanup 中引用但声明在其后 → 前移声明位置
- **`smart_segmenter.rs` 空操作借用**：`let _ = energy_data` 无意义，删除
- **`smart_segmenter.rs` 尾部窗口丢失**：能量计算循环丢弃不足 window_samples 的尾部样本 → 追加尾部窗口计算
- **`TauriBridge.ts` TS 编译错误**：方法间缺少逗号分隔符 + `mixAudio`/`getAudioDuration` 缺 `async` → 修复

### ⚙️ Chores

- **死代码删除**：`i18next` + `react-i18next`（无源码引用，~50KB）
- **死代码删除**：3 个 pipeline 文件（`CommentaryPipeline.ts` / `RewriteScriptStep.ts` / `SynthesizeVoiceStep.ts`）— 从未有任何 consumer 调用
- **`vite.config.ts`**：移除 `vendor-i18n` chunk 规则（对应 dead deps）
- **`alignmentQuality` 死逻辑删除**：`orchestrateCommentaryAgents` 返回值从未被持久化，`ScriptData` 接口无 `alignmentSummary` 字段，useMemo 结果无下游消费者
- **`handleGenerateVoice` progress 回调**：进度回调应作为第三参数传入 `synthesize()` 而非 options 字段内

### 📝 Docs

- **`docs/dev/tauri-commands.md`**：新增 Audio Commands 节（`mix_audio` / `get_audio_duration`）、Rust-side Highlight Detection（含 `suggested_speed` 字段定义和速度推导算法）
- **`docs/dev/project-structure.md`**：重写 Rust 目录结构，匹配实际 `commands/` 子模块布局（`render/transcode.rs` 等 5 个 render 子模块）
- **`docs/guide/configuration.md`**：精简为 in-app 设置指南，环境变量详情指向 `docs/reference/config.md`
- **`docs/dev/build-release.md`**：统一 `pnpm` → `npm` 命令（package.json 使用 npm）
- **`docs/guide/installation.md`**：统一 `pnpm` → `npm` 命令

### 🔧 Code Quality

- **ESLint 警告**：39 → 8（−31，79% 清除率）
- **TS 编译错误**：维持 0 个（`--skipLibCheck`）
- **批量 unused vars 清理**：25+ 文件删除未使用 import/变量

### 🗑 Removed

- `i18next`, `react-i18next` — 无源码引用
- `vendor-i18n` Vite chunk rule — 对应 dead deps

---

## [2.0.1] - 2026-05-01

- **src/constants/index.ts:** Add missing `legacy.token` and `legacy.projects` to `STORAGE_KEYS` for backward compatibility
- **src/components/workspace/ScriptWriting.tsx:** Add missing `useRef` to React import; add null checks for `Timeout | null` before calling `timeout.clear()`
- **src/components/editor/Timeline/TimelinePanel.tsx:** Add `return undefined` in useEffect for non-isPlaying code path (TS7030)
- **src/core/services/providers/base.service.ts:** Rename `delay` parameter to `delayMs` to avoid shadowing imported `delay()` function
- **src/shared/utils/pipeline-checkpoint.ts:** Replace `new Promise(resolve => setTimeout(resolve, 1000))` with `delay(1000)`
- **src/test/code-review.test.ts:** Add `EslintJsonOutput` type to replace 7× `any` type assertions; properly type coverage data mapping and diagnostic messageText

### ⚙️ Chores

- **docs:** Add `docs/ARCHITECTURE.md` (depth architecture doc) and `docs/DEVELOPER_GUIDE.md` (developer guide)
- **README:** Add AI model table (9 providers), update directory structure, fix docs navigation
- **workflow:** Consolidate `workflow.types.ts`, `workflow.constants.ts`, `workflow.initialState.ts` → `workflow.ts` (eliminate circular imports)
- **dead code:** Remove ScriptGenerator, MenuBar, appConfig.ts, templates/dedup/, and orphaned LESS/CSS files

---

## v2.0.0 (2026-04-22)

### 🎨 UI Overhaul
- **shadcn/ui migration:** Replaced Ant Design 5 with shadcn/ui + Tailwind CSS for modern, lightweight components
- **Professional tool aesthetic:** Dark-first design inspired by DaVinci Resolve / Premiere Pro
- **Timeline rebuilt:** Completely rebuilt with shadcn components — TimelinePanel, TimelineRuler, TimelineClip, TimelineTrack, TimelineToolbar, TimelineScrubber
- **Editor panels rebuilt:** Inspector, MediaBrowser, Preview, ExportBar, MenuBar, Settings — all with shadcn
- **Color system:** Professional orange (#f97316) accent, deep charcoal backgrounds, JetBrains Mono for timecodes

### 🔧 Technical
- **Tailwind CSS:** Full design token system with CSS custom properties
- **Bundle size reduction:** Lighter UI framework replaces Ant Design

### 🤖 CI/CD
- **Multi-platform CI/CD:** GitHub Actions `release.yml` triggers on git tag push
- **5 parallel builds:** Windows x64, macOS (ARM64 + x64), Linux (x64 + ARM64)
- **8 release artifacts:** .exe, .msi, .dmg (×2), .deb (×2), .AppImage (×2)
- **macOS run guide:** HOW-TO-RUN.txt included with 3 methods to bypass unsigned app warning

### 🐛 Bug Fixes
- (list any bugs fixed in this release)

## [1.9.7] - 2026-04-19

### 🔒 Security

- **API 密钥加密存储**：API 密钥不再明文保存到 `api_keys.json`，改用 `tauri-plugin-store` 加密存储（AES 加密的 Store 文件）
  - `Cargo.toml`：新增 `tauri-plugin-store = "2"`
  - `src-tauri/src/lib.rs`：注册 `tauri_plugin_store::Builder`
  - `capabilities/default.json`：添加 `store:*` 权限
  - `src/services/tauri.ts`：`getApiKey`/`saveApiKey` 改用加密 Store API

### 🐛 Bug Fixes

- **修复 VideoEditor 导出类型安全**：`export.service.ts` 的 `exportVideo` 参数改为 `Partial<ExportConfig>` + 内部补全默认值，移除下游双重 `as ExportConfig` cast
- **修复 `handleAnalysisComplete` 闭包陷阱**：`useCallback` 依赖数组补全 `apiKeys` 和 `defaultModel`
- **修复音量/缩放边界**：添加 `VOLUME_MIN/MAX`、`ZOOM_MIN/MAX` 常量约束，修复越界 NaN 风险

### ⚙️ Code Quality

- **消除 Magic Numbers**：提取 8 个命名常量（`DEFAULT_ZOOM`、`DEFAULT_SNAP_THRESHOLD_MS`、`THUMBNAIL_WIDTH` 等），所有硬编码值替换为常量
- **网络重试机制**：`Projects` 页面 `loadProjects`/`loadAppData` 新增 `fetchWithRetry`（3 次指数退避：1s → 2s → 4s），网络抖动自动恢复
- **Settings 类型清理**：移除 `CORE_MODELS as any` 和 `as any[]` 不安全 cast，修复上游泛型约束

## [1.9.2] - 2026-04-14

### 🔒 Security & Performance

- **P0: Remove `devtools` from release builds** (`Cargo.toml`): The `devtools` Tauri feature was previously enabled for all builds, exposing DevTools API in production binaries. Fixed by removing from `features = []`.
- **P0: Enable strict CSP policy** (`tauri.conf.json`): Previously `"csp": null` disabled Content Security Policy entirely. Replaced with strict policy: `default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://*`

### ⚡ Performance — Async I/O

**12 Tauri commands converted from sync blocking to async** (主线程不再阻塞):

| Command | Before | After |
|---------|--------|-------|
| `check_ffmpeg` | `std::process::Command` | `tokio::process::Command` + `.await` |
| `analyze_video` | sync ffprobe | async ffprobe |
| `generate_thumbnail` | sync ffmpeg | async ffmpeg |
| `extract_key_frames` | `fs::read_dir` + sync ffmpeg | `tokio_fs::read_dir` + async |
| `check_app_data_directory` | `fs::create_dir_all` | `tokio_fs::async` |
| `save/load/delete_project_file` | `fs` sync | `tokio_fs` async |
| `list_project_files` | `fs::read_dir` | `tokio_fs::read_dir` async |
| `list_app_data_files` | `fs` sync | `tokio_fs::async` |
| `delete_file / read_text_file / get_file_size` | `fs` sync | `tokio_fs` async |

- `tokio`: added `fs` feature to `Cargo.toml`

### 🏗️ Architecture — P2 Module Split

**`lib.rs` 1314 lines → 10 lines** (thin facade):

```
src-tauri/src/
├── lib.rs           10 lines (facade, re-exports)
├── types.rs         all input/output structs
├── binary.rs        ffmpeg/ffprobe path resolution
├── utils.rs         parse_fraction, chrono_like_timestamp, format_srt_time
└── commands/
    ├── mod.rs       submodules
    ├── ffprobe.rs   check_ffmpeg, analyze_video
    ├── project.rs  8 project/file management commands
    ├── ai.rs        generate_thumbnail, extract_key_frames,
    │                run_ai_director_plan, detect_*, get_export_dir
    └── render.rs    transcode_with_crop, render_autonomous_cut + helpers
```

- Net: `+1285 / -1312` lines, more precise responsibility boundaries

---

## [1.9.1] - 2026-04-11

### 🔧 Code Quality

- **TypeScript strict 模式启用**：59 个 strict/implicitAny 错误全部修复，跨 15 个文件
  - `useVideo.ts`：新增 `TaskStatusInfo` 类型定义，消除 `taskStatus: any`
  - `AIAssistant.tsx`：修复 `getAvailableModelsFromApiKeys` 参数类型
  - `asr.service.ts`：解决 `SpeechRecognition` 循环引用类型
  - `clipRepurposing/pipeline.ts`：`StepOptions` 类型兼容修复
  - `trackManager.ts`/`aiService.ts`：数组字面量类型强化
  - `appStore`/`editorStore`/`projectStore`：Zustand store 状态类型标注
  - `logger.ts`：上下文参数 `Record<string, unknown>` → `unknown`
  - `tauri.ts`：Tauri invoke 返回值类型标注

---

## [1.9.0] - 2026-04-10

### ✨ Features

- **Rust highlight_detector.rs 已激活**：FFmpeg scdet + 音频能量分析，通过 visionService.detectHighlights() 为剪辑评分提供真实数据
- **6维评分接入 pipeline**：clipScorer 新增 audioEnergy 加权，笑声/情感维度基于真实音频信号
- **Timeline 快捷键真实回调**：Delete/I/O/⌘A/⌘Z/⇧⌘Z 均接入 editorStore
- **SubtitleExtractor 重构**：集成视频播放器 + 字幕时间轴 + 行内编辑

### 🐛 Bug Fixes

- editorStore 新增 inPointMs/outPointMs/setInPoint/setOutPoint/selectAllClips
- Rust 新增 get_export_dir 命令（平台下载目录）
- clipRepurposing pipeline 接入 Rust 高光检测并去重

### 🎨 P2: HighlightList 组件

- 从 _DEAD/ 回收 HighlightPanel 设计 → AIAnalyze 完成视图

---

## [1.8.0] - 2026-04-10

### 🔧 Code Quality

- **TypeScript 严格模式全面修复**：183 个 `strictNullChecks` 错误全部清零，跨 15+ 模块修复类型安全问题
- **antd Tree-shaking**：启用 `babel-plugin-import`，按需引入 antd 组件，减少 bundle 体积
- **Rust 代码质量**：消除 `as any`、死代码清理、`Math.random` 数据污染移除

### 🐛 Bug Fixes

- **Timeline 虚拟化 bug**：`scrollLeftRef` 不触发重渲染问题修复
- **transcode_with_crop**：16:9 格式支持 + 1:1 filter 语法修复
- **SmartCut 静音检测**：接入 Rust 实现，替换 `Math.random()` 模拟
- **前端构建错误**：VideoPlayer 导入路径 + invoke 模块 + tauri 版本问题

### 🎨 Design Quality

- **ThemeContext token 系统**：与 index.css OKLCH 色彩系统对齐
- **ant-input 暗色模式**：修复白底黑字配色问题
- **emoji 无障碍**：添加 role="img" + aria-label
- **图标按钮无障碍**：添加 aria-label

### 📚 Documentation

- VitePress 主题支持深色/浅色模式切换
- README + 文档全面升级
- 默认主题改为浅色模式

---

## [1.7.0] - 2026-04-07

### 🎉 Phase 1 + Phase 2 + Phase 3 功能升级

#### Phase 1 — 核心功能集成

- **多格式裁切导出**: Rust 层实现 `transcode_with_crop` 命令，支持 9:16（抖音竖屏）/ 1:1（小红书方屏）/ 16:9 三种格式，FFmpeg scale+crop filter 注入
- **ClipRepurposing Pipeline**: 新增完整 UI（ClipRepurpose.tsx），集成 6 维评分引擎（笑声/情感/完整度/静默比/节奏/关键词）+ SEO 元数据 + 多格式导出
- **AI 字幕生成**: SubtitleEditor 接入 Whisper ASR 服务，支持模型选择 + 语言设置 + 一键生成字幕
- **主流程串联**: AI 拆条步骤完整接入主流程（7步完整链路）

#### Phase 2 — 体验完善

- **快捷键体系**: 新增 `useKeyboardShortcuts` Hook（空格/K/J/L/I/O/Delete/⌘Z/⌘E等），接入 AIVideoEditor
- **导出进度细化**: VideoExport 接入 Rust `processing-progress` 事件监听，实时显示阶段名称（编码/渲染/合成/写入）+ ETA 剩余时间

#### Phase 3 — 架构优化

- **Timeline 虚拟化**: `useVirtualTimeline` Hook，基于二分查找计算可见 clip 范围，ResizeObserver 监听容器宽度，滚动时仅渲染可见区域 + 两侧各 3 个 buffer clips，大幅降低 100+ clips 时的渲染开销

---

## [1.6.5] - 2026-04-07

### 🐛 Bug 修复

- **package.json 版本同步**: 修复 v1.6.4 发布后 package.json 仍为 v1.6.0 的版本不一致问题
- **Rust 死代码清理**: 移除 `segment_by_energy` 中未使用变量 `next_duration`、`mid_point`、`segment_energy_sum/count`，消除编译警告

---

## [1.6.4] - 2026-04-06

### 📁 文件结构优化

- **Hooks 重复定义合并**: `src/shared/hooks/index.ts` + `src/core/utils/hooks.ts` → `src/hooks/index.ts`
- 统一为单一 hooks 导出入口，消除三处分散定义，净减少 350 行重复代码

---

## [1.6.3] - 2026-04-06

### 🏗️ 核心架构优化

- **VisionService 并行分析**: `detectObjects` + `analyzeEmotions` 并行执行（Promise.all），耗时减半
- **消除冗余调用**: `analyzeVideo` 已返回 scenes，`detectScenes` 调用消除
- **移除死代码**: 删除 `detectScenes` + `detectSilence` 私有方法（-36 行）
- **optimizeScenes Map 查表**: 嵌套 filter.find O(n²) → 预建 Map O(n)

---

## [1.6.2] - 2026-04-06

### ⚡ 性能优化

- **WaveformCanvas**: `segments.find` O(n) → Map 查表 O(1)，大量字幕时每帧减少数万次遍历
- **cacheManager**: `JSON.parse(JSON.stringify)` → `structuredClone`（引擎级优化）
- **exportCache**: 移除 pretty-print

---

## [1.6.1] - 2026-04-06

### ⚡ 性能优化

- **concurrentMap**: 首页/Dashboard 项目加载并发限流（≤8），降低文件系统压力
- **StorageService.export**: 移除多余 pretty-print（`null,2` → 无参数），减少大型项目序列化开销

---

## [1.4.0] - 2026-04-06

### 🏗️ 核心流程架构升级

- **aiClipExecutor**: `executeAIClipStep` 返回值现写入 `WorkflowData.aiClipResult`，AI 剪辑结果不再丢失
- **musicExecutor**: `music` 步骤已注册，配乐结果写入 `WorkflowData.musicStepOutput`
- **subtitleExecutor**: 改进 skip 消息为"ASR 服务未安装，跳过字幕识别"

### 🔧 类型安全强化

- `adapters.ts`: 移除 3 处 `as any`，`WorkflowConfig` 新增 `videoFile` + `whisperConfig` 字段
- `ai.service.ts`: `Promise.allSettled` 显式类型化，移除 map 回调 `s:any` / `k:any`

### 🐛 Bug 修复

- `VisionService.extractKeyframes`: **补全缺失方法**（此前调用恒返回 rejected，keyframes 永远为空）

### ✨ Lint 修复

- `FilterThumb` / `MultiTrackTimeline` / `WaveformCanvas`: 添加 `displayName`
- `Layout.tsx`: `Tooltip` 从 `antd` 而非 `@ant-design/icons` 导入
- `MultiTrackTimeline.tsx`: 修复 `clip={` 重复属性 JSX 语法错误

---

## [1.3.0] - 2026-04-05

### 🎨 UI 全面升级 — AI Cinema Studio

- **设计系统重构**：深炭底 #0C0D14 + 琥珀光 #FF9F43 + 电青色 #00D4FF
- **字体升级**：Outfit（标题）+ Figtree（正文）+ JetBrains Mono（时间码）
- **玻璃拟态**：所有卡片采用 rgba(20,21,32,0.8) + backdrop-filter blur(20px)
- **全局动画**：神经网络脉冲、扫描线纹理、自定义滚动条

### ✨ 组件重设计

- **Layout**：全新侧栏（琥珀光强调）+ 顶栏（用户信息）
- **Dashboard**：玻璃拟态卡片 + 状态 Badge（琥珀/电青/灰）
- **Landing**：Canvas 粒子 Hero + 3步骤流 + 4列特性网格
- **Fablr 工作流**：垂直步骤列表 + 四态动画（完成/进行/等待）
- **VideoUpload**：拖拽脉冲动画 + 琥珀光进度条
- **AIAnalyze**：神经网络可视化（电青脉冲点阵）
- **ProjectCreate / ScriptGenerate / VideoSynthesize / VideoExport**：全组件重设计
- **EffectsPanel**：4×3 滤镜网格 + 琥珀滑块
- **HighlightPanel / SmartSegmentPanel**：JetBrains Mono 时间码 + 热度条
- **SubtitleEditor**：Canvas 波形 + 琥珀播放头

### 🛠️ antd Tooltip 深色主题覆盖

- 自定义深色 Tooltip + 四个方向箭头修正
- 带琥珀光晕的 accent 变体

### 🐛 修复

- Dashboard index.module.less 缺失 @radius-full 变量

---
# 更新日志

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-04-04

### 🏗️ 架构升级

- **Zustand Store 治理**：
  - `mainStore.ts`：移除 dead field `autoSave`/`isDarkMode`（与 `appStore` 重复，无任何引用点）
  - `appStore.ts`：`autoSave` 从嵌套 `userSettings` 提升到顶层字段 `autoSave`，并新增 `setAutoSave` action
  - `src/store/theme.ts`：删除（与 `ThemeContext.useTheme` 命名冲突，无调用点）
  - `src/hooks/useSettings.ts`：删除 `useAppSettings` 函数（dead function，无调用点）
  - 状态拓扑收束：`appStore`=UI+设置，`mainStore`=AI模型配置，各自职责清晰

- **视频处理管道接口抽象**：
  - 新建 `src/core/video/`：types.ts | IVideoProcessor.ts | TauriVideoProcessor.ts | formatters.ts | index.ts
  - `IVideoProcessor`：后端无关接口，定义 `analyze / extractKeyFrames / generateThumbnail / cut / preview`
  - `TauriVideoProcessor`：Tauri invoke 实现类，单例 `videoProcessor`，parseVideoError 收敛于此
  - `formatters`：纯函数（`formatDuration / formatResolution / formatBitrate / formatFileSize`），无副作用
  - `video.ts` 降级为 facade，代理所有导出，兼容已有调用点
  - 核心收益：可切换实现（Tauri → WebCodecs 或测试 mock）

- **Workflow 引擎状态机化**：
  - 新增 `WorkflowEngine.ts`：图执行器，基于 `WORKFLOW_MODE_DEFINITIONS` 构建实际执行序列
  - 新增 `IStepExecutor.ts`：步骤执行器接口，`execute(ctx)` 返回表示成功
  - 条件跳过：`config` 驱动（`autoAnalyze / autoGenerateScript / autoDedup / aiClipConfig`）
  - 重试机制：`ctx.retry()` 抛出 `RetryRequest`，引擎自动 `attempt++` 后重试
  - 跳过机制：`ctx.skip()` 抛出 `SkipRequest`，继续下一步骤
  - 进度广播：订阅者模式 + `STEP_WEIGHTS` 映射表，总进度 0-100
  - `pause / resume / abort` 支持
  - 原有 `workflowService.ts` 和 step executor 函数完全保留，向后兼容

- **Services 索引更新**：
  - `workflow/index.ts`：新增 `WorkflowEngine`、`IStepExecutor` 导出

## [1.1.1] - 2026-04-02

### 🔧 代码优化

- Editor 页面：移除未使用 import（Row/Col/Drawer）
- Editor 页面：修复 useEffect 依赖缺失问题
- Editor 页面：复制按钮添加完整处理逻辑
- Editor 页面：字幕文字截断逻辑优化（短文本不显示省略号）
- Editor 页面：效果面板添加占位提示
- Editor 编辑器：完整实现 copyClip 复制功能
  - 新增 `COPY_CLIP` action 类型
  - 新增 `copyClip` timeline 操作函数
  - 新增 `copyClip` hook 操作
- Timeline 组件：新增 clipMap（HashMap），片段查找从 O(n²) 降为 O(1)
- Timeline 组件：handlePasteClip bug 修复（精确匹配轨道 ID）
- TimelineRuler：window.innerWidth 改为常量，避免非响应式引用
- WorkflowMonitor：移除 eslint-disable，Timeline items 添加 key
- TimelineClip：移除未使用 Badge import，修复 handleDoubleClick 依赖
- ai.service：移除废弃的 generateMockScenes/generateMockKeyframes
- VideoExport.tsx：移除未使用 import

### 📖 文档更新

- README.md：优化文档结构，更新项目结构说明
- AI 模型配置：完善多厂商配置文档
- 文档精品化升级（VitePress 专业设计）

---

## [1.1.0] - 2026-03-28

### 🎭 新功能

#### 剧情分析模式 (Plot Analysis Mode) ✨NEW

**核心功能**:

- **剧情图谱 (Plot Timeline)**: 自动分析视频中的剧情结构，生成可视化的故事节点图谱
- **节点类型识别**: 
  - 背景铺垫 (Setup)
  - 上升情节 (Rising Action)
  - 高潮 (Climax)
  - 情感转折 (Emotional Beat)
  - 对话场景 (Dialogue)
  - 动作场景 (Action)
- **情感分析**: 识别视频中的情绪变化轨迹
- **多版本输出**:
  - 📼 剧情完整版 (Full Narrative)
  - ✂️ 精华版 (Highlights Reel)  
  - ⚡ 高能混剪版 (Intense Mix)

**技术实现**:

- 视频帧采样 + 场景检测
- 音频转文字 (ASR) + 对话分析
- 情绪识别 (兴奋/平静/紧张等)
- LLM 剧情理解 (时间戳 + 文字描述 → 剧情结构分析)
- 多模态融合剪辑决策

**新增模块**:

- `src/core/services/plotAnalysis.service.ts` - 剧情分析服务

#### 项目重命名

- **旧名称**: StoryFab (126+ 同名项目，侵权风险)
- **新名称**: Fablr
- 体现"AI视频创作 + 故事叙事"的核心价值

### 📚 文档更新

- **README.md**: 全新专业化设计
  - Hero section + 技术栈徽章
  - 功能概览表格
  - 快速开始指南
  - 架构模块图
- **ARCHITECTURE.md**: 扩展架构文档
  - 新增剧情分析服务架构
  - 插件系统设计
  - 扩展点说明
- **DEVELOPER.md**: 新增开发者指南
  - 环境搭建
  - 调试技巧
  - 添加新功能指南
- **CONTRIBUTING.md**: 扩展贡献指南
  - Commit 格式规范
  - PR 流程
  - 分支管理

### 🏗️ 架构升级

- 领域模型清晰化
- Service 层模块化
- 准备 Plugin 系统支持不同 AI 模型

---

## [1.0.0-beta] - 2026-03-10

### 🚀 新功能

- **AI 智能剪辑**
  - 场景切换检测
  - 音频峰值识别 (笑声、掌声)
  - 运动强度分析
  - 自动生成精彩集锦

- **智能字幕**
  - 语音转字幕 (ASR)
  - 多语言翻译
  - 字幕风格化
  - 导出 SRT/ASS/VTT

- **自动配乐**
  - 情绪匹配音乐
  - 本地音乐库
  - 淡入淡出
  - 用户上传

- **多模型接入**
  - OpenAI API
  - Anthropic Claude
  - 本地模型支持
  - 自定义 API

### ⚡ 性能优化

- UI 无障碍优化 (aria-labels, keyboard navigation)
- 组件懒加载
- 图片懒加载

### 🔧 改进

- README 完善
- 统一日志系统
- 主题系统优化

### 📦 依赖更新

- React 18
- Tauri 2.x
- Ant Design 5
- TypeScript 5

---

## [0.9.0-alpha] - 2026-01

### 🚀 新功能 (初版)

- 项目管理系统
- 视频上传与管理
- 基础剪辑功能
- AI 解说生成
- AI 混剪
- POV 叙事

---

## 迁移指南

### 从 1.0.x 升级到 1.1.0

1. 更新依赖：`npm install`
2. 拉取最新代码：`git pull origin main`
3. 如使用旧剪辑模式，参考新的剧情分析模式

### 从 0.9.x 升级到 1.0

1. 更新依赖：`npm install`
2. 重新构建：`npm run tauri build`

---

## 旧版本

- 查看 [GitHub Releases](https://github.com/agions/fablr/releases)
