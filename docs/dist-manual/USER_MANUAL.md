# Fablr (剧工) 桌面端用户使用手册

> **版本**：v2.2.1  
> **开源地址**：[https://github.com/Agions/fablr](https://github.com/Agions/fablr)  
> **适用平台**：macOS (Apple Silicon / Intel) / Windows 10/11 / Linux (Ubuntu/Debian/Fedora/AppImage)

---

## 📖 1. 软件简介

**Fablr (剧工)** 是一款基于 **Tauri 2 + Rust + React** 架构的本地优先（Local-first）开源 AI 影视与短剧解说创作平台。  
平台集成了**素材智能拆条、多 Agent 剧本研磨、以文剪片 5 轨工作台、消重矩阵与剪映草稿一键导出**等核心能力，帮助创作者在数分钟内将长视频/短剧原片制作成高爆款潜力的解说作品。

---

## 🚀 2. 快速上手指南（4 步工作流）

### 步骤 1：新建项目与素材拆条 (Asset Hub)
1. 启动客户端，点击首页 **「新建创作项目」**；
2. 命名项目并选择解说风格（如短剧爽感反转、深度伦理等）；
3. 进入 **素材工坊**，点击 **「批量导入素材」** 导入原片（支持 `.mp4`, `.mov`, `.mkv` 等格式）；
4. 本地引擎将自动执行镜头切分并打上场景标签（`打斗 🥊`、`悬疑 🔍`、`高潮 💥`）。

### 步骤 2：多 Agent 剧本研磨 (Script Studio)
1. 点击右上角 **「前往剧本工坊」**；
2. 选择心仪的爆款剧本模板，点击 **「一键研磨剧本」**；
3. **策划、编剧、审校** 三大 AI Agent 自动生成黄金前 3 秒 Hook、递进段落与高潮反转；
4. 直接编辑微调解说词，系统实时预估字数与配音时长。

### 步骤 3：以文剪片与多轨合成 (Workspace)
1. 点击 **「去剪辑合成 →」** 进入视听工作台；
2. 在 **「以文剪片」** 视图中，点击剧本段落即可将高匹配度的精彩镜头一键吸附至主视频轨；
3. 在 **「5 轨时间轴」** 视图中查看画面、画中画、解说配音、BGM 与音效，按空格键实时预览。

### 步骤 4：消重矩阵与剪映草稿导出 (Export Hub)
1. 进入 **消重发布工坊**，按需开启变速、动态噪点、画中画氛围光等消重策略；
2. 选择 **「导出剪映草稿工程」**：无缝注入本机剪映草稿，可直接在剪映中精修特效与花字；
3. 或选择 **「本地硬件加速渲染」**：直接导出 MP4 成片。

---

## ⌨️ 3. 常用快捷键一览

| 快捷键 (macOS) | 快捷键 (Windows/Linux) | 功能说明 |
| :--- | :--- | :--- |
| `Cmd + 1` ~ `Cmd + 4` | `Ctrl + 1` ~ `Ctrl + 4` | 快速切换 4 大核心工坊 |
| `Space` | `Space` | 播放 / 暂停视听预览 |
| `S` | `S` | 一键剪切当前光标处轨道切片 |
| `Delete` / `Backspace` | `Delete` / `Backspace` | 删除选中片段 |
| `Cmd + S` | `Ctrl + S` | 立即触发原子化强制保存 |
| `Cmd + Z` / `Cmd + Shift + Z` | `Ctrl + Z` / `Ctrl + Shift + Z` | 撤销 / 重做 |
| `+` / `-` | `+` / `-` | 放大 / 缩小时间轴刻度 |
| `Cmd + Enter` | `Ctrl + Enter` | 剧本工坊中触发一键生成/续写 |
| `Cmd + /` | `Ctrl + /` | 随时调出快捷键帮助面板 |

---

## 🛠️ 4. 常见问题排查 (FAQ)

### Q1: macOS 提示「无法验证开发者」或「已损坏」？
- **原因**：macOS Gatekeeper 安全机制对未签名应用的常规提示。
- **解决方法**：打开终端（Terminal），粘贴并运行以下命令：
  ```bash
  sudo xattr -rd com.apple.quarantine /Applications/Fablr.app
  ```
  输入开机密码后即可正常打开。

### Q2: 导出的剪映草稿在剪映中打开提示「素材丢失」？
- **原因**：剪映草稿通过本地文件路径引用原片素材。
- **解决方法**：导出草稿后请勿移动或重命名导入的原片；如已移动，在剪映弹窗中点击「重新定位」选中新位置的原视频即可恢复。

### Q3: AI 生成剧本时网络超时？
- **解决方法**：进入左侧底部「设置中心」检查大模型 API Key 与代理 Base URL 配置，建议使用国内高速大模型（如 DeepSeek 等）。

---

## 📮 5. 支持与反馈
- **GitHub Issues**：[https://github.com/Agions/fablr/issues](https://github.com/Agions/fablr/issues)
- **官方文档**：[https://github.com/Agions/fablr/tree/main/docs](https://github.com/Agions/fablr/tree/main/docs)
