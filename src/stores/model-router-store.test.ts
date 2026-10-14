/**
 * stores/model-router-store.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useModelRouterStore } from './model-router-store';
import { localInferenceService } from '@/core/services/ai/local-inference-service';

describe('useModelRouterStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with local_first strategy and default endpoint', () => {
    const state = useModelRouterStore.getState();
    expect(state.strategy).toBe('local_first');
    expect(state.localEndpoint).toBe('http://localhost:11434');
    expect(state.localStatus.alive).toBe(false);
  });

  it('detects healthy local Ollama service and auto-selects recommended model', async () => {
    vi.spyOn(localInferenceService, 'checkHealth').mockResolvedValueOnce({
      alive: true,
      endpoint: 'http://localhost:11434',
      serverType: 'ollama',
      version: '0.3.14',
      models: ['llama3:latest', 'qwen2.5:7b'],
    });

    vi.spyOn(localInferenceService, 'recommendDramaModel').mockReturnValueOnce('qwen2.5:7b');

    const store = useModelRouterStore.getState();
    const status = await store.detectLocalHealth();

    expect(status.alive).toBe(true);
    expect(status.serverType).toBe('ollama');

    const updated = useModelRouterStore.getState();
    expect(updated.localStatus.alive).toBe(true);
    expect(updated.preferredLocalModel).toBe('qwen2.5:7b');
    expect(updated.isDetecting).toBe(false);
    expect(updated.lastDetectedAt).not.toBeNull();
  });

  it('updates strategy and preferred model reactively', () => {
    const store = useModelRouterStore.getState();

    store.setStrategy('cloud_only');
    expect(useModelRouterStore.getState().strategy).toBe('cloud_only');

    store.setPreferredLocalModel('deepseek-r1:8b');
    expect(useModelRouterStore.getState().preferredLocalModel).toBe('deepseek-r1:8b');
  });
});
