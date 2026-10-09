# 自定义模型与 Agent 扩展

## 1. 接入自定义大模型提供商

Fablr 的多 Agent 研磨体系（`multiAgentDramaPipeline`）基于适配器模式设计，天然支持接入任何兼容 OpenAI 标准接口的模型网关或本地模型。

### 在设置中心配置
在客户端 `设置中心` → `模型提供商` 中填入：
- **API Endpoint**：例如 `https://api.deepseek.com/v1` 或 本地 Ollama `http://localhost:11434/v1`
- **API Key**：您的授权密钥（100% 加密存储于本地安全存储中）
- **模型名称**：如 `deepseek-chat`、`gpt-4o`、`qwen-2.5-72b`

---

## 2. 扩展新赛道解说 Prompt 模板

若想新增专属的解说题材（例如 `科技科普解说`、`游戏高光解说`），可以在 `drama-agents.ts` 中扩展 `DRAMA_GENRE_PROMPTS`：

```typescript
export const DRAMA_GENRE_PROMPTS: Record<string, GenrePromptConfig> = {
  custom_tech: {
    genre: 'custom_tech',
    genreLabel: '科技硬核解说',
    directorPrompt: `你是一位专业科技博主，善于将复杂的底层原理用通俗比喻拆解。请提炼一个反直觉的黄金 3 秒 Hook，并规划 4 段式递进骨架...`,
    writerTone: '通俗生动、节奏明快、充满极客探索感',
  },
};
```

---

## 3. 自定义 TTS 配音引擎扩展

Fablr 默认内置 Edge-TTS 与本地 TTS 引擎，若需对接自定义语音合成提供商（如 CosyVoice / ChatTTS），可在 `src/core/services/ai/voice-synthesis-service.ts` 中实现统一的接口：

```typescript
export interface ITTSEngine {
  synthesize(text: string, voiceId: string, speed: number): Promise<ArrayBuffer>;
  listVoices(): Promise<VoiceOption[]>;
}
```
