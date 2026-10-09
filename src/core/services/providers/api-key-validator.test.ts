import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateApiKey } from './api-key-validator';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: fetch resolves with ok: true
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  describe('input validation', () => {
    it('should reject empty api key', async () => {
      const result = await validateApiKey('openai', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API 密钥格式无效');
    });

    it('should reject whitespace-only api key', async () => {
      const result = await validateApiKey('openai', '   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API 密钥格式无效');
    });

    it('should reject api key shorter than 10 chars', async () => {
      const result = await validateApiKey('openai', 'sk-short');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API 密钥格式无效');
    });
  });

  describe('OpenAI', () => {
    it('should validate correct OpenAI key', async () => {
      const result = await validateApiKey('openai', 'sk-validopenai1234567890');
      expect(result.isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer sk-validopenai1234567890' }),
        })
      );
    });

    it('should handle 401 unauthorized', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });
      const result = await validateApiKey('openai', 'sk-invalid1234567890');
      expect(result.isValid).toBe(false);
    });

    it('should handle 403 forbidden', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      });
      const result = await validateApiKey('openai', 'sk-forbidden1234567890');
      expect(result.isValid).toBe(false);
    });

    it('should handle timeout', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            const err = new DOMException('The operation was aborted.', 'AbortError');
            reject(err);
          })
      );
      const result = await validateApiKey('openai', 'sk-timeout1234567890');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API 密钥验证超时，请检查网络连接');
    });
  });

  describe('DeepSeek', () => {
    it('should validate correct DeepSeek key', async () => {
      const result = await validateApiKey('deepseek', 'sk-deepseekvalid1234567890');
      expect(result.isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/models',
        expect.any(Object)
      );
    });
  });

  describe('Anthropic', () => {
    it('should validate correct Anthropic key', async () => {
      const result = await validateApiKey('anthropic', 'sk-antropicvalid1234567890');
      expect(result.isValid).toBe(true);
    });
  });

  describe('iFlytek', () => {
    it('should reject iflytek key without commas', async () => {
      const result = await validateApiKey('iflytek', 'no-comma-key');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('讯飞星火 API 密钥格式无效（应为 app_id,api_key,api_secret）');
    });

    it('should reject iflytek key with less than 3 parts', async () => {
      const result = await validateApiKey('iflytek', 'part1,part2');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('讯飞星火 API 密钥格式无效（应为 app_id,api_key,api_secret）');
    });

    it('should accept valid iflytek format', async () => {
      const result = await validateApiKey('iflytek', 'app_id,api_key,api_secret');
      expect(result.isValid).toBe(true);
    });
  });

  describe('unknown provider', () => {
    it('should skip validation for unknown provider', async () => {
      const result = await validateApiKey('unknown-provider', 'any-key-value-12345');
      expect(result.isValid).toBe(true);
    });
  });

  describe('network errors', () => {
    it('should handle non-fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Unexpected error'));
      const result = await validateApiKey('openai', 'sk-network1234567890');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should handle fetch errors without response', async () => {
      mockFetch.mockRejectedValue(new Error('Network failed'));
      const result = await validateApiKey('openai', 'sk-noresp1234567890');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Google', () => {
    it('validates via generativelanguage API with key in URL', async () => {
      const key = 'googlesecret1234567890';
      const result = await validateApiKey('google', key);
      expect(result.isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.any(Object)
      );
      expect(mockFetch.mock.calls[0][0]).toContain(encodeURIComponent(key));
    });
  });

  describe('Baidu', () => {
    it('rejects baidu key without colon separator', async () => {
      const result = await validateApiKey('baidu', 'no-colon-here');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/百度 API 密钥格式无效/);
    });

    it('validates baidu key with apiKey:apiSecret format', async () => {
      const result = await validateApiKey('baidu', 'baiduApiKey1234567890:baiduSecret1234567890');
      expect(result.isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('aip.baidubce.com/oauth/2.0/token'),
        expect.any(Object)
      );
    });
  });

  describe('Alibaba', () => {
    it('validates alibaba dashscope key', async () => {
      const result = await validateApiKey('alibaba', 'alibabakey1234567890');
      expect(result.isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('dashscope.aliyuncs.com'),
        expect.any(Object)
      );
    });
  });

  describe('Zhipu', () => {
    it('validates zhipu glm-4 key', async () => {
      const result = await validateApiKey('zhipu', 'zhipukey1234567890');
      expect(result.isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('open.bigmodel.cn'),
        expect.any(Object)
      );
    });
  });

  describe('Moonshot', () => {
    it('validates moonshot Kimi key', async () => {
      const result = await validateApiKey('moonshot', 'moonshotkey1234567890');
      expect(result.isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.moonshot.cn'),
        expect.any(Object)
      );
    });
  });

  describe('error status mapping', () => {
    it('maps 401 to "API 密钥无效或已过期"', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });
      const result = await validateApiKey('openai', 'sk-401key1234567890');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API 密钥无效或已过期');
    });

    it('maps 403 to "API 密钥没有访问权限"', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      });
      const result = await validateApiKey('openai', 'sk-403key1234567890');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API 密钥没有访问权限');
    });

    it('maps other status codes to default error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });
      const result = await validateApiKey('openai', 'sk-500key1234567890');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API 密钥验证失败');
    });
  });
});
