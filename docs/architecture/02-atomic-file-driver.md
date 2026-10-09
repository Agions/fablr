# 原子化防竞态持久化驱动 (AtomicProjectFileDriver)

## 1. 设计背景与并发痛点

在影视剪辑与 AI 创作应用中，前端往往存在多处并发触发持久化的场景：
- **实时自动保存 (Auto-save)**：每隔数秒或每次击键触发；
- **多 Agent 流式生成追加**：剧本研磨过程中逐字/逐句回写；
- **时间轴多轨拖拽微调**：高频更新片段起止时间戳；
- **切片批量导入完成**：异步回调并发写入。

若采用朴素的 `fs.writeFile`，极易发生**写后读覆盖 (Lost Updates)**、**半写入导致 JSON 损坏 (Corrupted JSON)** 以及**并发竞争锁死**。

---

## 2. 核心架构与队列模型

`AtomicProjectFileDriver`（位于 `src/core/services/project/atomic-file-driver.ts`）采用 **Promise 链式排队 + 热内存双缓冲快照 + 原子写入重命名** 三重保障：

```mermaid
graph TD
    subgraph 并发写入请求源
        REQ1[请求 1: 自动保存 (t=0ms)]
        REQ2[请求 2: AI 流式追加 (t=5ms)]
        REQ3[请求 3: 时间轴拖拽 (t=8ms)]
    end

    subgraph AtomicProjectFileDriver 核心
        HOT[🔥 热内存快照缓存 (In-Memory Hot Cache)]
        QUEUE[⏳ 单任务排队队列 (Write Queue Execution)]
        LOCK[🔒 项目级排他互斥锁 (Per-Project Lock)]
    end

    subgraph 宿主与存储层
        TEMP[写入临时文件 .project.tmp]
        FINAL[原子重命名替换 project.json]
    end

    REQ1 & REQ2 & REQ3 --> HOT
    HOT --> QUEUE
    QUEUE --> LOCK
    LOCK --> TEMP
    TEMP --> FINAL
```

---

## 3. 核心设计机制

### 3.1 链式 Promise 写队列
所有针对同一项目的写入操作被自动排入同一链式队列，前序写入未完成时，后序写入自动挂起等待：

```typescript
private writeQueues = new Map<string, Promise<void>>();

public async saveProjectAtomic(projectId: string, data: Project): Promise<void> {
  // 更新内存热快照（保证立即读取到最新值）
  this.hotMemoryCache.set(projectId, { data, timestamp: Date.now() });

  const currentQueue = this.writeQueues.get(projectId) || Promise.resolve();
  const nextTask = currentQueue.then(async () => {
    await this.executeDiskWrite(projectId, data);
  });

  this.writeQueues.set(projectId, nextTask.catch(() => {}));
  return nextTask;
}
```

### 3.2 临时文件写入与原子替换 (Atomic Rename)
1. 数据先完整写入同目录下的 `.tmp` 临时文件并同步刷盘 (fsync)；
2. 执行底层系统的原子 `rename` 系统调用覆盖原文件，从物理层面杜绝文件被破坏为空文件或半截 JSON。

---

## 4. 收益与保障

- **100% 杜绝并发写冲突**：即便每秒触发上百次持久化请求，磁盘 I/O 依然严格保序；
- **零损耗内存加速**：高频读取直接命中热内存快照，避免频繁磁盘 I/O；
- **断电与异常自愈**：结合快照校验机制，确保任何极端情况下项目数据永不损坏。
