import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LocalInferenceService,
  localInferenceService,
  DEFAULT_OLLAMA_ENDPOINT,
} from './local-inference-service';

describe('LocalInferenceService', () => {
  let service: LocalInferenceService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new LocalInferenceService('http://localhost:11434');
  });

  describe('checkHealth', () => {
    it('detects healthy Ollama server', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
        expect(String(url)).toContain('/api/version');
        return new Response(JSON.stringify({ version: '0.3.14' }), { status: 200 });
      });

      const result = await service.checkHealth();
      expect(result.alive).toBe(true);
      expect(result.serverType).toBe('ollama');
      expect(result.version).toBe('0.3.14');
    });

    it('detects OpenAI-compatible server when Ollama endpoint 404s', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockImplementationOnce(async () => new Response('Not found', { status: 404 }))
        .mockImplementationOnce(async (url) => {
          expect(String(url)).toContain('/v1/models');
          return new Response(JSON.stringify({ data: [{ id: 'local-model' }] }), { status: 200 });
        });

      const result = await service.checkHealth();
      expect(result.alive).toBe(true);
      expect(result.serverType).toBe('openai-compatible');
    });

    it('returns offline when all endpoints fail or time out', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkHealth();
      expect(result.alive).toBe(false);
      expect(result.serverType).toBe('offline');
      expect(result.error).toBeTruthy();
    });
  });

  describe('listModels', () => {
    it('returns empty array when server is offline', async () => {
      vi.spyOn(service, 'checkHealth').mockResolvedValueOnce({
        alive: false,
        endpoint: DEFAULT_OLLAMA_ENDPOINT,
        serverType: 'offline',
      });

      const models = await service.listModels();
      expect(models).toEqual([]);
    });

    it('parses Ollama tags response', async () => {
      vi.spyOn(service, 'checkHealth').mockResolvedValueOnce({
        alive: true,
        endpoint: DEFAULT_OLLAMA_ENDPOINT,
        serverType: 'ollama',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [{ name: 'qwen2.5:7b' }, { name: 'deepseek-r1:7b' }],
          }),
          { status: 200 }
        )
      );

      const models = await service.listModels();
      expect(models).toEqual(['qwen2.5:7b', 'deepseek-r1:7b']);
    });
  });

  describe('recommendDramaModel', () => {
    it('returns null for empty array', () => {
      expect(service.recommendDramaModel([])).toBeNull();
    });

    it('prioritizes qwen2.5:14b over qwen2.5:7b', () => {
      const models = ['llama3.1:8b', 'qwen2.5:7b', 'qwen2.5:14b'];
      expect(service.recommendDramaModel(models)).toBe('qwen2.5:14b');
    });

    it('falls back to first model if no preference matched', () => {
      const models = ['custom-model-alpha', 'custom-model-beta'];
      expect(service.recommendDramaModel(models)).toBe('custom-model-alpha');
    });
  });

  describe('chat', () => {
    it('executes chat completion and returns message content', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '这是生成的解说词' } }],
          }),
          { status: 200 }
        )
      );

      const content = await service.chat({
        model: 'qwen2.5:7b',
        messages: [{ role: 'user', content: '写一段解说' }],
      });

      expect(content).toBe('这是生成的解说词');
    });

    it('throws error when server responds with 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );

      await expect(
        service.chat({
          model: 'qwen2.5:7b',
          messages: [{ role: 'user', content: '写一段解说' }],
        })
      ).rejects.toThrow(/本地推理错误 \[HTTP 500\]/);
    });
  });

  describe('chatStream', () => {
    it('streams tokens from SSE response', async () => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"她"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"以为"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"这是真的"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        start(controller) {
          sseChunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
          controller.close();
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(readableStream, { status: 200 })
      );

      const generator = service.chatStream({
        model: 'qwen2.5:7b',
        messages: [{ role: 'user', content: '生成流' }],
      });

      const collected: string[] = [];
      for await (const chunk of generator) {
        collected.push(chunk);
      }

      expect(collected.join('')).toBe('她以为这是真的');
    });
  });

  describe('singleton export', () => {
    it('exports a valid default singleton instance and default endpoint', () => {
      expect(localInferenceService).toBeInstanceOf(LocalInferenceService);
      expect(DEFAULT_OLLAMA_ENDPOINT).toBe('http://localhost:11434');
    });
  });
});
