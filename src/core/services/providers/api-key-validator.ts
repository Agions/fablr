/**
 * API 密钥验证服务
 */
import { logger } from '@/shared/utils/logging';

interface ApiKeyValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Helper: fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`) as Error & { statusCode: number };
      err.statusCode = res.status;
      throw err;
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 验证 API 密钥
 */
export const validateApiKey = async (provider: string, apiKey: string): Promise<ApiKeyValidationResult> => {
  if (!apiKey || apiKey.trim().length < 10) {
    return { isValid: false, error: 'API 密钥格式无效' };
  }

  try {
    switch (provider) {
      case 'openai':
        await fetchWithTimeout('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        break;

      case 'deepseek':
        await fetchWithTimeout('https://api.deepseek.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        break;

      case 'anthropic':
        // Anthropic 使用 Messages API 进行验证
        await fetchWithTimeout(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4.6',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'ping' }],
            }),
          }
        );
        break;

      case 'google':
        // Google AI Studio API 验证
        await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
          {}
        );
        break;

      case 'baidu':
        // 百度文心 - 验证 access_token，格式：apiKey:apiSecret
        const [baiduApiKey, baiduSecret] = apiKey.split(':');
        if (!baiduApiKey || !baiduSecret) {
          return { isValid: false, error: '百度 API 密钥格式无效（应为 api_key:api_secret）' };
        }
        await fetchWithTimeout(
          `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(baiduApiKey)}&client_secret=${encodeURIComponent(baiduSecret)}`,
          { method: 'POST' }
        );
        break;

      case 'alibaba':
        // 阿里通义千问 - 使用 chat/completions 验证
        await fetchWithTimeout(
          'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'qwen2.5-max', messages: [{ role: 'user', content: 'hi' }] }),
          }
        );
        break;

      case 'iflytek':
        // 讯飞星火 - 验证 app_id 和 api_key 格式
        if (!apiKey.includes(',') || apiKey.split(',').length < 3) {
          return { isValid: false, error: '讯飞星火 API 密钥格式无效（应为 app_id,api_key,api_secret）' };
        }
        // 讯飞验证需要额外参数，暂时检查格式
        break;

      case 'zhipu':
        // 智谱清言 - 使用 chat/completions 验证
        await fetchWithTimeout(
          'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'glm-4', messages: [{ role: 'user', content: 'hi' }] }),
          }
        );
        break;

      case 'moonshot':
        // Moonshot Kimi - 使用 chat/completions 验证
        await fetchWithTimeout(
          'https://api.moonshot.cn/v1/chat/completions',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'moonshot-v1-8k', messages: [{ role: 'user', content: 'hi' }] }),
          }
        );
        break;

      default:
        // 未知提供商，跳过验证但记录警告
        logger.warn(`[ApiKeyService] 未知的 AI 提供商: ${provider}，跳过验证`);
        return { isValid: true };
    }

    return { isValid: true };
  } catch (error: unknown) {
    let errorMessage = 'API 密钥验证失败';

    if (error && typeof error === 'object' && 'statusCode' in error) {
      const status = (error as { statusCode: number }).statusCode;
      if (status === 401) {
        errorMessage = 'API 密钥无效或已过期';
      } else if (status === 403) {
        errorMessage = 'API 密钥没有访问权限';
      }
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      errorMessage = 'API 密钥验证超时，请检查网络连接';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return { isValid: false, error: errorMessage };
  }
};

/**
 * 测试 API 连接
 */
