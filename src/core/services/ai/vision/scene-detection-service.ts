/**
 * 场景检测服务
 * 职责：视频场景分割、分类和特征分析
 */

import type { VideoInfo, Scene } from '@/types';
import type { SceneFeatureSet } from '../types';
import { SCENE_TYPES } from '../types';
import { logger } from '../../../../shared/utils/logging';
import { isTauriEnv } from '@/shared/utils/platform';
import { convertFileSrc } from '@tauri-apps/api/core';
import { OUT_SCENE_PALETTE } from '@/core/video/output-colors';

// ============================================
// 场景检测配置
// ============================================
interface SceneClassificationResult {
  id: string;
  description: string;
  keywords: string[];
  confidence: number;
}

// ============================================
// 场景检测服务
// ============================================

class SceneDetectionService {
  /**
   * 分割视频为场景片段
   * @param videoInfo 视频信息
   * @param minDuration 最小场景时长（秒）
   * @returns 场景列表
   */
  async segmentScenes(videoInfo: VideoInfo, minDuration: number = 3): Promise<Scene[]> {
    const scenes: Scene[] = [];
    const segmentDuration = Math.max(minDuration, videoInfo.duration / 20);
    const numScenes = Math.floor(videoInfo.duration / segmentDuration);

    logger.info('[SceneDetection] 开始场景分割', {
      duration: videoInfo.duration,
      segmentDuration,
      estimatedScenes: numScenes,
    });

    for (let i = 0; i < numScenes; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, videoInfo.duration);

      // 生成缩略图
      const thumbnail = await this.generateThumbnail(videoInfo.path, startTime);

      scenes.push({
        id: `scene_${i}_${Date.now()}`,
        startTime,
        endTime,
        type: 'action' as const,
        score: 0,
        thumbnail,
        description: '',
        tags: [] as string[],
        confidence: 0,
      } as Scene);
    }

    return scenes;
  }

  /**
   * 对场景进行分类
   * @param scenes 场景列表
   * @param videoInfo 视频信息
   * @returns 分类后的场景列表
   */
  async classifyScenes(scenes: Scene[], videoInfo: VideoInfo): Promise<Scene[]> {
    return Promise.all(
      scenes.map(async scene => {
        // 基于场景位置和内容进行分类
        const position = scene.startTime / videoInfo.duration;

        // 分析场景特征
        const features = await this.analyzeSceneFeatures(scene, videoInfo);

        // 匹配场景类型
        const matchedType = this.matchSceneType(features, position);

        return {
          ...scene,
          type: matchedType.id as Scene['type'],
          description: matchedType.description,
          tags: [...matchedType.keywords, ...features.tags],
          confidence: matchedType.confidence,
          features: [
            `brightness:${features.brightness}`,
            `motion:${features.motion}`,
            `complexity:${features.complexity}`,
            ...features.tags,
          ],
        } as Scene;
      })
    );
  }

  /**
   * 分析场景特征
   * @deprecated 🔴 BETA — 当前使用 Math.random() 模拟特征，非真实 CV 分析
   */
  private async analyzeSceneFeatures(
    scene: Scene,
    videoInfo: VideoInfo
  ): Promise<{
    brightness: number;
    motion: number;
    complexity: number;
    dominantColors: string[];
    hasText: boolean;
    hasFaces: boolean;
    tags: string[];
  }> {
    const position = scene.startTime / videoInfo.duration;
    const tags: string[] = [];

    // 基于位置推断
    if (position < 0.1) tags.push('开场');
    if (position > 0.9) tags.push('结尾');
    if (position > 0.3 && position < 0.7) tags.push('主体');

    // 基于时长推断
    const duration = scene.endTime - scene.startTime;
    if (duration > 10) tags.push('长镜头');
    if (duration < 3) tags.push('快速切换');

    return {
      brightness: Math.random() * 0.5 + 0.25,
      motion: Math.random() * 0.6 + 0.2,
      complexity: Math.random() * 0.7 + 0.15,
      dominantColors: this.generateDominantColors(),
      hasText: Math.random() > 0.7,
      hasFaces: Math.random() > 0.6,
      tags,
    };
  }

  /**
   * 匹配场景类型
   */
  private matchSceneType(features: SceneFeatureSet, position: number): SceneClassificationResult {
    // 开场检测
    if (position < 0.15) {
      return {
        id: 'intro',
        description: '视频开场，建议用引人入胜的方式介绍主题',
        keywords: ['开场', '介绍', '引入'],
        confidence: 0.9,
      };
    }

    // 结尾检测
    if (position > 0.85) {
      return {
        id: 'outro',
        description: '视频结尾，适合总结和呼吁行动',
        keywords: ['结尾', '总结', '呼吁'],
        confidence: 0.9,
      };
    }

    // 基于特征匹配
    let bestMatch = SCENE_TYPES[0];
    let maxConfidence = 0;

    if (features.hasFaces && features.motion > 0.5) {
      bestMatch = SCENE_TYPES.find(s => s.id === 'interview') || SCENE_TYPES[0];
      maxConfidence = 0.75;
    } else if (features.hasText) {
      bestMatch = SCENE_TYPES.find(s => s.id === 'text') || SCENE_TYPES[0];
      maxConfidence = 0.8;
    } else if (features.motion > 0.6) {
      bestMatch = SCENE_TYPES.find(s => s.id === 'action') || SCENE_TYPES[0];
      maxConfidence = 0.7;
    } else if (features.complexity > 0.6) {
      bestMatch = SCENE_TYPES.find(s => s.id === 'product') || SCENE_TYPES[0];
      maxConfidence = 0.65;
    }

    return {
      id: bestMatch.id,
      description: bestMatch.description,
      keywords: bestMatch.keywords,
      confidence: maxConfidence,
    };
  }

  /**
   * 生成缩略图（兼容桌面端文件路径与安全降级）
   */
  private async generateThumbnail(videoPath: string, timestamp: number): Promise<string> {
    if (typeof document === 'undefined' || !videoPath) {
      return '';
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const cleanup = () => {
        isSettled = true;
        clearTimeout(timer);
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        video.src = '';
      };

      const timer = setTimeout(() => {
        if (!isSettled) {
          cleanup();
          resolve('');
        }
      }, 1500);

      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.crossOrigin = 'anonymous';

      video.onloadeddata = () => {
        if (isSettled) return;
        canvas.width = 320;
        canvas.height = Math.round(320 * (video.videoHeight / (video.videoWidth || 1)));
        video.currentTime = Math.max(0, timestamp);
      };

      video.onseeked = () => {
        if (isSettled) return;
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            cleanup();
            resolve(dataUrl);
            return;
          } catch {
            cleanup();
            resolve('');
            return;
          }
        } else {
          cleanup();
          reject(new Error('无法创建画布'));
          return;
        }
      };

      video.onerror = () => {
        if (isSettled) return;
        cleanup();
        reject(new Error('无法加载视频'));
      };

      const src =
        isTauriEnv() &&
        !videoPath.startsWith('http://') &&
        !videoPath.startsWith('https://') &&
        !videoPath.startsWith('blob:') &&
        !videoPath.startsWith('data:') &&
        !videoPath.startsWith('asset:')
          ? convertFileSrc(videoPath)
          : videoPath;

      video.src = src;
    });
  }

  /**
   * 生成主导颜色
   */
  private generateDominantColors(): string[] {
    // ⚠️ BETA mock：调色板用于模拟占位输出，实际 CV 分析接入后由真实算法返回
    // 调色板集中管理于 @/core/video/output-colors (OUT_SCENE_PALETTE)
    const colors = OUT_SCENE_PALETTE;
    const numColors = Math.floor(Math.random() * 2) + 2;
    const shuffled = [...colors].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numColors);
  }
}

// 导出单例
export const sceneDetectionService = new SceneDetectionService();
