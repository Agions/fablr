/**
 * core/services/ai/hybrid-model-router.ts — 端云混合模型路由器与自愈容灾控制器
 *
 * 职责：
 * 1. 统一管理 Agent 推理请求的路由决策（本地端侧 SLM vs 云端主力大模型）；
 * 2. 具备自动自愈容灾 (Auto-Fallback)：当本地离线、端口阻塞或显存 OOM 时，
 *    自动平滑降级至云端模型 (DeepSeek-V3 / Qwen 等) 保障创作不中断；
 * 3. 输出完整的路由元数据与耗时追踪 (RoutingMeta)，支撑前端状态反馈。
 */

import { localInferenceService, type LocalInferenceService } from './local-inference-service';
import { invokeAIModel } from './script/ai-api-client';
import type { AIModelType } from './script/ai-model-configs';

export type RoutingStrategy = 'local_first' | 'cloud_first' | 'local_only' | 'cloud_only';

export interface RoutingMeta {
  target: 'local' | 'cloud';
  model: string;
  provider: string;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  latencyMs: number;
}

export interface HybridRouteRequest {
  strategy?: RoutingStrategy;
  prompt: string;
  systemPrompt?: string;
  localEndpoint?: string;
  preferredLocalModel?: string;
  cloudProvider?: AIModelType;
  cloudApiKey?: string;
  cloudModelId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface HybridChatResult {
  content: string;
  meta: RoutingMeta;
}

export interface HybridStreamChunk {
  type: 'token' | 'meta';
  token?: string;
  meta?: RoutingMeta;
}

export class HybridModelRouter {
  private localService: LocalInferenceService;

  constructor(localService: LocalInferenceService = localInferenceService) {
    this.localService = localService;
  }

  /**
   * 统一同步聊天路由（带自动自愈降级）
   */
  async routeChat(req: HybridRouteRequest): Promise<HybridChatResult> {
    const strategy = req.strategy ?? 'local_first';
    const startTime = Date.now();

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.prompt });

    // 1. 如果指定仅云端
    if (strategy === 'cloud_only') {
      return this.executeCloud(req, startTime);
    }

    // 2. 如果指定本地优先或仅本地
    if (strategy === 'local_first' || strategy === 'local_only') {
      const health = await this.localService.checkHealth(req.localEndpoint);

      if (health.alive) {
        let chosenModel = req.preferredLocalModel;
        if (!chosenModel) {
          const installed = await this.localService.listModels(req.localEndpoint);
          chosenModel = this.localService.recommendDramaModel(installed) || 'qwen2.5:7b';
        }

        try {
          const content = await this.localService.chat({
            endpoint: req.localEndpoint,
            model: chosenModel,
            messages,
            temperature: req.temperature,
            maxTokens: req.maxTokens,
          });

          return {
            content,
            meta: {
              target: 'local',
              model: chosenModel,
              provider: health.serverType,
              fallbackTriggered: false,
              latencyMs: Date.now() - startTime,
            },
          };
        } catch (localErr) {
          if (strategy === 'local_only') {
            throw localErr;
          }
          // 本地执行报错，触发平滑降级至云端
          const reason = localErr instanceof Error ? localErr.message : '本地推理执行异常';
          return this.executeCloud(req, startTime, true, reason);
        }
      }

      // 本地离线
      if (strategy === 'local_only') {
        throw new Error(`本地推理服务未在线: ${health.error || '端口未开放'}`);
      }

      // 自动降级至云端
      return this.executeCloud(req, startTime, true, '本地端侧环境未启动或探测超时');
    }

    // 3. cloud_first 策略
    try {
      return await this.executeCloud(req, startTime);
    } catch (cloudErr) {
      const reason = cloudErr instanceof Error ? cloudErr.message : '云端 API 调用失败';
      // 尝试降级至本地
      const health = await this.localService.checkHealth(req.localEndpoint);
      if (health.alive) {
        const installed = await this.localService.listModels(req.localEndpoint);
        const model = req.preferredLocalModel || this.localService.recommendDramaModel(installed) || 'qwen2.5:7b';
        const content = await this.localService.chat({
          endpoint: req.localEndpoint,
          model,
          messages,
          temperature: req.temperature,
          maxTokens: req.maxTokens,
        });

        return {
          content,
          meta: {
            target: 'local',
            model,
            provider: health.serverType,
            fallbackTriggered: true,
            fallbackReason: reason,
            latencyMs: Date.now() - startTime,
          },
        };
      }
      throw cloudErr;
    }
  }

  /**
   * 统一流式打字机路由（带自动自愈降级）
   */
  async *routeChatStream(req: HybridRouteRequest): AsyncGenerator<HybridStreamChunk, void, unknown> {
    const strategy = req.strategy ?? 'local_first';
    const startTime = Date.now();

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.prompt });

    if (strategy === 'local_first' || strategy === 'local_only') {
      const health = await this.localService.checkHealth(req.localEndpoint);

      if (health.alive) {
        let chosenModel = req.preferredLocalModel;
        if (!chosenModel) {
          const installed = await this.localService.listModels(req.localEndpoint);
          chosenModel = this.localService.recommendDramaModel(installed) || 'qwen2.5:7b';
        }

        try {
          const stream = this.localService.chatStream({
            endpoint: req.localEndpoint,
            model: chosenModel,
            messages,
            temperature: req.temperature,
            maxTokens: req.maxTokens,
          });

          yield {
            type: 'meta',
            meta: {
              target: 'local',
              model: chosenModel,
              provider: health.serverType,
              fallbackTriggered: false,
              latencyMs: Date.now() - startTime,
            },
          };

          for await (const token of stream) {
            yield { type: 'token', token };
          }
          return;
        } catch (err) {
          if (strategy === 'local_only') {
            throw err;
          }
          const reason = err instanceof Error ? err.message : '本地流式中断';
          // 降级云端
          yield* this.executeCloudStream(req, startTime, true, reason);
          return;
        }
      }

      if (strategy === 'local_only') {
        throw new Error(`本地推理服务离线: ${health.error || '端口未开放'}`);
      }

      yield* this.executeCloudStream(req, startTime, true, '本地服务未启动，自动切换云端');
      return;
    }

    // cloud_only 或其他
    yield* this.executeCloudStream(req, startTime, false);
  }

  // ─────────────────────────────────────────────────────────────
  // 内部辅助调用方法
  // ─────────────────────────────────────────────────────────────

  private async executeCloud(
    req: HybridRouteRequest,
    startTime: number,
    fallbackTriggered = false,
    fallbackReason?: string
  ): Promise<HybridChatResult> {
    const provider: AIModelType = req.cloudProvider ?? 'deepseek';
    const apiKey = req.cloudApiKey || '';

    const content = await invokeAIModel(provider, apiKey, req.prompt, {
      model: req.cloudModelId,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    });

    return {
      content,
      meta: {
        target: 'cloud',
        model: req.cloudModelId || provider,
        provider,
        fallbackTriggered,
        fallbackReason,
        latencyMs: Date.now() - startTime,
      },
    };
  }

  private async *executeCloudStream(
    req: HybridRouteRequest,
    startTime: number,
    fallbackTriggered: boolean,
    fallbackReason?: string
  ): AsyncGenerator<HybridStreamChunk, void, unknown> {
    const cloudRes = await this.executeCloud(req, startTime, fallbackTriggered, fallbackReason);

    yield {
      type: 'meta',
      meta: cloudRes.meta,
    };

    // 云端目前作为打字机逐块吐出
    const chars = Array.from(cloudRes.content);
    const chunkSize = 4;
    for (let i = 0; i < chars.length; i += chunkSize) {
      yield {
        type: 'token',
        token: chars.slice(i, i + chunkSize).join(''),
      };
    }
  }
}

export const hybridModelRouter = new HybridModelRouter();
