/**
 * stores/model-router-store.ts
 *
 * 混合推理与端侧大模型路由状态机 (Model Router & SLM Store)
 *
 * 职责：
 * 1. 监控本地 Ollama / LMStudio 端点健康状态、网络延迟与已安装模型清单；
 * 2. 管理路由偏好策略 ('local_first' | 'cloud_only' | 'local_only')；
 * 3. 向设置面板与 Agent 引擎提供实时的可用算力拓扑。
 */

import { create } from 'zustand';
import {
  DEFAULT_OLLAMA_ENDPOINT,
  localInferenceService,
  type LocalServerHealth,
} from '@/core/services/ai/local-inference-service';
import type { RoutingStrategy } from '@/core/services/ai/hybrid-model-router';
import { logger } from '@/shared/utils/logging';

export interface ModelRouterState {
  /** 路由策略 */
  strategy: RoutingStrategy;

  /** 本地推理服务地址 */
  localEndpoint: string;

  /** 推荐或偏好的本地大模型名称 */
  preferredLocalModel: string;

  /** 本地服务连通性状态 */
  localStatus: LocalServerHealth;

  /** 是否正在探测中 */
  isDetecting: boolean;

  /** 上次检测完成时间 */
  lastDetectedAt: string | null;

  // ── Actions ──────────────────────────────────────────────────
  /** 探测本地 SLM 服务健康状况与模型列表 */
  detectLocalHealth: () => Promise<LocalServerHealth>;

  /** 设置路由策略 */
  setStrategy: (strategy: RoutingStrategy) => void;

  /** 更新本地服务地址并立即重新探测 */
  setLocalEndpoint: (endpoint: string) => Promise<void>;

  /** 设置选中的本地模型 */
  setPreferredLocalModel: (model: string) => void;
}

export const useModelRouterStore = create<ModelRouterState>((set, get) => ({
  strategy: 'local_first',
  localEndpoint: DEFAULT_OLLAMA_ENDPOINT,
  preferredLocalModel: 'qwen2.5:7b',
  localStatus: {
    alive: false,
    endpoint: DEFAULT_OLLAMA_ENDPOINT,
    serverType: 'offline',
  },
  isDetecting: false,
  lastDetectedAt: null,

  detectLocalHealth: async () => {
    const { localEndpoint } = get();
    set({ isDetecting: true });

    try {
      localInferenceService.setEndpoint(localEndpoint);
      const status = await localInferenceService.checkHealth();

      let preferredModel = get().preferredLocalModel;
      if (status.models && status.models.length > 0) {
        const recommended = localInferenceService.recommendDramaModel(status.models);
        if (recommended) {
          preferredModel = recommended;
        }
      }

      set({
        localStatus: status,
        isDetecting: false,
        lastDetectedAt: new Date().toISOString(),
        preferredLocalModel: preferredModel,
      });

      return status;
    } catch (error) {
      logger.warn('detectLocalHealth failed:', error);
      const offlineStatus: LocalServerHealth = {
        alive: false,
        endpoint: localEndpoint,
        serverType: 'offline',
        error: String(error),
      };

      set({
        localStatus: offlineStatus,
        isDetecting: false,
        lastDetectedAt: new Date().toISOString(),
      });

      return offlineStatus;
    }
  },

  setStrategy: (strategy: RoutingStrategy) => {
    set({ strategy });
  },

  setLocalEndpoint: async (endpoint: string) => {
    set({ localEndpoint: endpoint });
    await get().detectLocalHealth();
  },

  setPreferredLocalModel: (model: string) => {
    set({ preferredLocalModel: model });
  },
}));
