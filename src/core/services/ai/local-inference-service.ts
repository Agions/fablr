/**
 * core/services/ai/local-inference-service.ts — 本地端侧 SLM 推理与环境探测服务
 *
 * 职责：
 * 1. 自动探测本地 OpenAI/Ollama 兼容服务健康状态 (localhost:11434)；
 * 2. 枚举本地已拉取的模型库并智能推荐短剧解说创作模型 (Qwen2.5/DeepSeek-R1)；
 * 3. 执行端侧本地推理（支持流式 SSE 逐字打字机产出与非流式调用）；
 * 4. 严格处理超时、连接拒绝与显存 OOM 异常。
 */

export interface LocalServerHealth {
  alive: boolean;
  endpoint: string;
  version?: string;
  serverType: 'ollama' | 'openai-compatible' | 'offline';
  error?: string;
  models?: string[];
}

export interface LocalChatRequest {
  endpoint?: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

/** 推荐的短剧解说与剧本创作模型优先级表 */
const PREFERRED_DRAMA_MODELS = [
  'qwen2.5:14b',
  'qwen2.5:7b',
  'qwen2.5:latest',
  'deepseek-r1:14b',
  'deepseek-r1:7b',
  'deepseek-r1:latest',
  'llama3.1:8b',
  'mistral:7b',
];

export class LocalInferenceService {
  private defaultEndpoint: string;

  constructor(endpoint = DEFAULT_OLLAMA_ENDPOINT) {
    this.defaultEndpoint = endpoint;
  }

  setEndpoint(endpoint: string): void {
    this.defaultEndpoint = endpoint;
  }

  getEndpoint(): string {
    return this.defaultEndpoint;
  }

  /**
   * 探测本地推理服务器健康状态（毫秒级心跳，防阻塞）
   */
  async checkHealth(endpoint = this.defaultEndpoint, timeoutMs = 800): Promise<LocalServerHealth> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 优先探测 Ollama 原生版本接口 /api/version
      const ollamaRes = await fetch(`${endpoint.replace(/\/$/, '')}/api/version`, {
        method: 'GET',
        signal: controller.signal,
      }).catch(() => null);

      if (ollamaRes && ollamaRes.ok) {
        clearTimeout(timer);
        const data = (await ollamaRes.json().catch(() => ({}))) as { version?: string };
        return {
          alive: true,
          endpoint,
          version: data.version || 'unknown',
          serverType: 'ollama',
        };
      }

      // 备选探测标准 /v1/models (LMStudio / vLLM / LocalAI)
      const v1Res = await fetch(`${endpoint.replace(/\/$/, '')}/v1/models`, {
        method: 'GET',
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timer);

      if (v1Res && v1Res.ok) {
        return {
          alive: true,
          endpoint,
          serverType: 'openai-compatible',
        };
      }

      return {
        alive: false,
        endpoint,
        serverType: 'offline',
        error: '本地服务未响应或端口未开放',
      };
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      return {
        alive: false,
        endpoint,
        serverType: 'offline',
        error: isAbort ? `连接超时 (${timeoutMs}ms)` : '无法建立连接',
      };
    }
  }

  /**
   * 获取本地安装的模型列表
   */
  async listModels(endpoint = this.defaultEndpoint): Promise<string[]> {
    const health = await this.checkHealth(endpoint);
    if (!health.alive) return [];

    try {
      if (health.serverType === 'ollama') {
        const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`);
        if (!res.ok) return [];
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        return (data.models || []).map(m => m.name);
      }

      // openai-compatible format
      const res = await fetch(`${endpoint.replace(/\/$/, '')}/v1/models`);
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      return (data.data || []).map(m => m.id);
    } catch {
      return [];
    }
  }

  /**
   * 智能挑选当前本地算力最适合影视解说的模型
   */
  recommendDramaModel(installedModels: string[]): string | null {
    if (!installedModels || installedModels.length === 0) return null;

    const lowerList = installedModels.map(m => m.toLowerCase());
    for (const pref of PREFERRED_DRAMA_MODELS) {
      const matchIdx = lowerList.findIndex(m => m === pref || m.startsWith(pref));
      if (matchIdx !== -1) {
        return installedModels[matchIdx];
      }
    }

    // 默认返回第一个可用模型
    return installedModels[0];
  }

  /**
   * 本地模型同步调用
   */
  async chat(request: LocalChatRequest): Promise<string> {
    const endpoint = request.endpoint || this.defaultEndpoint;
    const url = `${endpoint.replace(/\/$/, '')}/v1/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: false,
      }),
      signal: request.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`本地推理错误 [HTTP ${res.status}]: ${errText || '未知错误'}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return json.choices?.[0]?.message?.content || '';
  }

  /**
   * 本地模型流式打字机逐字返回生成器
   */
  async *chatStream(request: LocalChatRequest): AsyncGenerator<string, void, unknown> {
    const endpoint = request.endpoint || this.defaultEndpoint;
    const url = `${endpoint.replace(/\/$/, '')}/v1/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: true,
      }),
      signal: request.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`本地流式推理错误 [HTTP ${res.status}]: ${errText || '未知错误'}`);
    }

    if (!res.body) {
      throw new Error('本地推理未返回响应流');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // 保留最后一个可能未闭合的行
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') return;

          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              yield deltaContent;
            }
          } catch {
            // 忽略格式不全的中间块
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const localInferenceService = new LocalInferenceService();
