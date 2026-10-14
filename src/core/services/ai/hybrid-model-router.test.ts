import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HybridModelRouter,
  hybridModelRouter,
} from './hybrid-model-router';
import { LocalInferenceService } from './local-inference-service';
import * as aiApiClient from './script/ai-api-client';

describe('HybridModelRouter', () => {
  let mockLocalService: LocalInferenceService;
  let router: HybridModelRouter;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocalService = new LocalInferenceService('http://localhost:11434');
    router = new HybridModelRouter(mockLocalService);
  });

  describe('routeChat', () => {
    it('routes to local when local server is alive under local_first strategy', async () => {
      vi.spyOn(mockLocalService, 'checkHealth').mockResolvedValueOnce({
        alive: true,
        endpoint: 'http://localhost:11434',
        serverType: 'ollama',
      });
      vi.spyOn(mockLocalService, 'listModels').mockResolvedValueOnce(['qwen2.5:7b']);
      vi.spyOn(mockLocalService, 'chat').mockResolvedValueOnce('本地生成的短剧解说词');

      const result = await router.routeChat({
        prompt: '生成大纲',
        strategy: 'local_first',
      });

      expect(result.content).toBe('本地生成的短剧解说词');
      expect(result.meta.target).toBe('local');
      expect(result.meta.fallbackTriggered).toBe(false);
      expect(result.meta.model).toBe('qwen2.5:7b');
    });

    it('falls back to cloud when local server is offline under local_first strategy', async () => {
      vi.spyOn(mockLocalService, 'checkHealth').mockResolvedValueOnce({
        alive: false,
        endpoint: 'http://localhost:11434',
        serverType: 'offline',
        error: '端口未开放',
      });

      vi.spyOn(aiApiClient, 'invokeAIModel').mockResolvedValueOnce('云端 DeepSeek 生成的解说词');

      const result = await router.routeChat({
        prompt: '生成大纲',
        strategy: 'local_first',
        cloudProvider: 'deepseek',
        cloudApiKey: 'sk-test-key',
      });

      expect(result.content).toBe('云端 DeepSeek 生成的解说词');
      expect(result.meta.target).toBe('cloud');
      expect(result.meta.fallbackTriggered).toBe(true);
      expect(result.meta.fallbackReason).toContain('未启动');
    });

    it('falls back to cloud when local chat throws an error (e.g. OOM)', async () => {
      vi.spyOn(mockLocalService, 'checkHealth').mockResolvedValueOnce({
        alive: true,
        endpoint: 'http://localhost:11434',
        serverType: 'ollama',
      });
      vi.spyOn(mockLocalService, 'listModels').mockResolvedValueOnce(['qwen2.5:7b']);
      vi.spyOn(mockLocalService, 'chat').mockRejectedValueOnce(new Error('CUDA Out of Memory'));

      vi.spyOn(aiApiClient, 'invokeAIModel').mockResolvedValueOnce('降级云端成功');

      const result = await router.routeChat({
        prompt: '生成大纲',
        strategy: 'local_first',
      });

      expect(result.content).toBe('降级云端成功');
      expect(result.meta.target).toBe('cloud');
      expect(result.meta.fallbackTriggered).toBe(true);
      expect(result.meta.fallbackReason).toContain('CUDA Out of Memory');
    });

    it('throws error when local_only strategy fails and server is offline', async () => {
      vi.spyOn(mockLocalService, 'checkHealth').mockResolvedValueOnce({
        alive: false,
        endpoint: 'http://localhost:11434',
        serverType: 'offline',
      });

      await expect(
        router.routeChat({
          prompt: '本地测试',
          strategy: 'local_only',
        })
      ).rejects.toThrow(/本地推理服务未在线/);
    });

    it('directly invokes cloud when cloud_only strategy is specified', async () => {
      vi.spyOn(aiApiClient, 'invokeAIModel').mockResolvedValueOnce('纯云端结果');

      const result = await router.routeChat({
        prompt: '云端生成',
        strategy: 'cloud_only',
        cloudProvider: 'openai',
      });

      expect(result.content).toBe('纯云端结果');
      expect(result.meta.target).toBe('cloud');
      expect(result.meta.fallbackTriggered).toBe(false);
    });
  });

  describe('routeChatStream', () => {
    it('streams tokens from local service when healthy', async () => {
      vi.spyOn(mockLocalService, 'checkHealth').mockResolvedValueOnce({
        alive: true,
        endpoint: 'http://localhost:11434',
        serverType: 'ollama',
      });
      vi.spyOn(mockLocalService, 'listModels').mockResolvedValueOnce(['qwen2.5:7b']);

      async function* mockStream() {
        yield '黄金';
        yield '3秒';
        yield '开篇';
      }
      vi.spyOn(mockLocalService, 'chatStream').mockReturnValue(mockStream());

      const chunks: string[] = [];
      let receivedMeta = false;

      for await (const chunk of router.routeChatStream({ prompt: '测试流' })) {
        if (chunk.type === 'meta') {
          receivedMeta = true;
          expect(chunk.meta?.target).toBe('local');
        } else if (chunk.type === 'token') {
          chunks.push(chunk.token || '');
        }
      }

      expect(receivedMeta).toBe(true);
      expect(chunks.join('')).toBe('黄金3秒开篇');
    });

    it('falls back to cloud stream when local is offline', async () => {
      vi.spyOn(mockLocalService, 'checkHealth').mockResolvedValueOnce({
        alive: false,
        endpoint: 'http://localhost:11434',
        serverType: 'offline',
      });

      vi.spyOn(aiApiClient, 'invokeAIModel').mockResolvedValueOnce('云端流式内容');

      const chunks: string[] = [];
      let fallbackTriggered = false;

      for await (const chunk of router.routeChatStream({ prompt: '测试流' })) {
        if (chunk.type === 'meta') {
          fallbackTriggered = !!chunk.meta?.fallbackTriggered;
        } else if (chunk.type === 'token') {
          chunks.push(chunk.token || '');
        }
      }

      expect(fallbackTriggered).toBe(true);
      expect(chunks.join('')).toBe('云端流式内容');
    });
  });

  describe('singleton export', () => {
    it('exports a valid default singleton instance', () => {
      expect(hybridModelRouter).toBeInstanceOf(HybridModelRouter);
    });
  });
});
