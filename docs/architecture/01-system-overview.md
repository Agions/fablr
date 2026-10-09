# 系统整体架构与分层设计

## 1. 架构总览与清晰分层

Fablr (剧工) 采用标准现代化的 **清晰模块化架构 (Modular Clean Architecture)**，将全域强类型契约、共享工具库、领域核心服务、UI 组件与桌面原生运行时严格分层解耦：

```mermaid
graph TD
    classDef typePkg fill:#3b0764,stroke:#a855f7,stroke-width:2px,color:#fff;
    classDef utilPkg fill:#083344,stroke:#06b6d4,stroke-width:2px,color:#fff;
    classDef corePkg fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff;
    classDef uiPkg fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef appPkg fill:#18192a,stroke:#e2e8f0,stroke-width:2px,color:#fff;

    TYPES["src/types<br/>(全域强类型契约 / DTO)"]:::typePkg
    SHARED["src/shared<br/>(共享工具 / 格式化 / 常量 / 错误处理)"]:::utilPkg
    CORE["src/core<br/>(原子文件驱动 / 多Agent / 剪映逆向 / 升级服务)"]:::corePkg
    UI["src/components<br/>(工业级工坊组件 / 原子UI图元)"]:::uiPkg
    APP["src/pages & stores<br/>(工坊页面装配 / Zustand 全局状态机)"]:::appPkg

    TYPES --> SHARED
    TYPES --> CORE
    TYPES --> UI
    SHARED --> CORE
    SHARED --> UI
    CORE --> APP
    UI --> APP
    TYPES --> APP
    SHARED --> APP
```

---

## 2. 各模块职责边界与规范

| 模块目录 | 职责范围 | 典型模块 / 导出品 | 依赖约束 |
| :--- | :--- | :--- | :--- |
| **`src/types`** | 系统全域类型契约、领域模型 DTO、IPC 接口规范 | `Project`, `ScriptBlock`, `AssetClip`, `AppUpdateInfo` | **零业务依赖**（纯 TypeScript 类型定义） |
| **`src/shared`** | 纯函数工具、文件大小/时间格式化、平台感知、防抖重试 | `formatFileSize`, `formatDuration`, `notify`, `delay` | 仅允许依赖基础工具与 `src/types` |
| **`src/core`** | 领域核心服务、防竞态文件驱动、多 Agent 状态机、更新检测 | `AtomicProjectFileDriver`, `UpdaterService`, `DramaAgents` | 依赖 `types` 与 `shared` |
| **`src/components`** | 工业级业务组件、通用原子组件、时间轴与播放器 | `VideoPlayer`, `Timeline`, `Button`, `Dialog` | 依赖 `types`, `shared`, `core` |
| **`src/pages` & `src/stores`** | 路由页面装配、Zustand 全局状态机、Tauri IPC 接入 | `AssetHubPage`, `ScriptStudioPage`, `WorkspacePage` | 聚合调用各层服务与组件 |

---

## 3. 全链路数据流转模型

```mermaid
sequenceDiagram
    autonumber
    participant UI as React 页面与工坊
    participant Store as Zustand 全局状态
    participant Core as src/core (Atomic Driver)
    participant Rust as Tauri 2 / Rust 引擎
    participant Disk as 本地文件系统 (SQLite/JSON)

    UI->>Store: 用户操作 (如编辑剧本/调整时间轴)
    Store->>Core: 派发变更 (saveProject)
    Core->>Core: 队列排队 + 热内存缓存合并 (防竞态)
    Core->>Rust: 调用 invoke("project_save_atomic")
    Rust->>Disk: 原子写入临时文件并原子重命名 (Atomic Rename)
    Disk-->>Rust: 写入完成通知
    Rust-->>Core: 返回最新项目指纹
    Core-->>Store: 状态持久化成功
```

---

## 4. 技术栈选型原则

1. **本地优先与绝对隐私**：所有媒体资产与草稿工程均存储于用户磁盘，零强制上传；
2. **轻量极致与秒级启动**：基于 Tauri 2 + Rust，杜绝传统 Chromium 庞大臃肿的内存占用；
3. **架构防腐与单向数据流**：强类型约束与清晰分层，彻底杜绝跨层循环引用与过度伪工程。
