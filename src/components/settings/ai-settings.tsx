/**
 * AISettings — AI 设置面板
 * API Key: shadcn Input (password type, masked)
 * Model selector: shadcn Select (DeepSeek/OpenAI/Claude/Qwen/Kimi)
 * Test connection button (真正调用 apiKeyService.validateApiKey)
 */
import { memo, useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { validateApiKey } from '@/core/services/providers/api-key-validator';
import { AI_MODELS } from '@/core/config/ai-models-config';
import type { ModelProvider, AIModel } from '@/types';

interface AISettingsProps {
  apiKey?: string;
  model?: string;
  onApiKeyChange?: (key: string) => void;
  onModelChange?: (model: string) => void;
}

// 获取 provider 对应的 model id 前缀（用于 Test 时猜 provider）
function inferProvider(apiKey: string): ModelProvider | null {
  if (!apiKey) return null;
  if (apiKey.startsWith('sk-')) return 'openai';
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('AIza')) return 'google';
  if (apiKey.includes(':')) return 'deepseek';
  return null;
}

// 精选推荐模型列表（从 AI_MODELS 配置中筛选，使用真实 ID）
const RECOMMENDED_MODEL_IDS = [
  'gpt-5.5', 'deepseek-v4-flash', 'claude-sonnet-4-6',
  'kimi-k2.6', 'gemini-3.1-flash', 'qwen3.6-max-preview',
];

export const AISettings = memo<AISettingsProps>(({
  apiKey = '',
  model = 'deepseek-v4-flash',
  onApiKeyChange,
  onModelChange,
}) => {
  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string>('');
  const [showKey, setShowKey] = useState(false);

  // 只展示推荐的模型，过滤掉未找到的
  const recommendedModels = RECOMMENDED_MODEL_IDS
    .map(id => AI_MODELS.find(m => m.id === id))
    .filter((m): m is AIModel => Boolean(m));

  const handleTest = async () => {
    if (!apiKey?.trim()) {
      setTestError('请先输入 API Key');
      setTestState('error');
      return;
    }
    setTestState('testing');
    setTestError('');

    try {
      // 优先用当前选中模型对应的 provider，其次从 key 格式推断
      const selectedModel = AI_MODELS.find(m => m.id === model);
      const providerToTest: ModelProvider | null =
        (selectedModel?.provider as ModelProvider) || inferProvider(apiKey);

      if (!providerToTest) {
        setTestState('error');
        setTestError('无法确定 API Key 对应的服务商，请手动选择模型');
        return;
      }

      const result = await validateApiKey(providerToTest, apiKey);

      if (result.isValid) {
        setTestState('success');
      } else {
        setTestState('error');
        setTestError(result.error || '验证失败');
      }
    } catch {
      setTestState('error');
      setTestError('网络错误，请检查网络连接');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* API Key */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-secondary">API Key</label>
        <div className="flex gap-2">
          <Input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange?.(e.target.value)}
            placeholder="sk-... / sk-ant-... / AIza..."
            className="flex-1 h-8 text-xs bg-bg-tertiary border-border-subtle"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKey((v) => !v)}
            className="h-8 px-2 text-xs text-text-secondary"
          >
            {showKey ? 'Hide' : 'Show'}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleTest}
            disabled={testState === 'testing'}
            className="h-8 px-3 text-xs bg-accent-primary hover:bg-accent-primary-hover"
          >
            {testState === 'testing' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : testState === 'success' ? (
              <CheckCircle2 className="size-3.5 text-accent-success" />
            ) : testState === 'error' ? (
              <XCircle className="size-3.5 text-accent-danger" />
            ) : (
              'Test'
            )}
          </Button>
        </div>
        <p className="text-[10px] text-text-disabled">Keys are stored locally only</p>
        {testState === 'error' && testError && (
          <p className="text-[10px] text-accent-danger mt-1">{testError}</p>
        )}
      </div>

      {/* Model selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-secondary">Default Model</label>
        <div className="grid grid-cols-2 gap-2">
          {recommendedModels.map((m) => (
            <button
              key={m.id}
              onClick={() => onModelChange?.(m.id)}
              className={`
                h-8 px-3 rounded-md border text-xs font-medium transition-colors
                ${model === m.id
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-subtle bg-bg-tertiary text-text-secondary hover:text-text-primary hover:border-border-default'
                }
              `}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

AISettings.displayName = 'AISettings';
