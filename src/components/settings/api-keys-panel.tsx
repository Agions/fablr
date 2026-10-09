/**
 * API 密钥设置面板
 */
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { validateApiKey } from '@/core/services/providers/api-key-validator';
import { notify } from '@/shared';
import { MODEL_PROVIDERS } from '../../core/config/ai-models-config';
import { PROVIDER_NAMES } from '@/core/config/provider-names';
import type { ModelProvider } from '@/types';
import { Key, Eye, EyeOff, Trash2, Check, X, Loader2 } from 'lucide-react';

interface ApiKeyConfig {
  key: string;
  isValid?: boolean;
}

interface ApiKeysPanelProps {
  apiKeys: Partial<Record<ModelProvider, ApiKeyConfig>>;
  onUpdateKey: (provider: ModelProvider, key: string) => void;
  onDeleteKey: (provider: ModelProvider) => void;
}

const ApiKeysPanel: React.FC<ApiKeysPanelProps> = ({ apiKeys, onUpdateKey, onDeleteKey }) => {
  const [testingProvider, setTestingProvider] = useState<ModelProvider | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<ModelProvider>>(new Set());

  const handleTest = useCallback(async (provider: ModelProvider, key: string) => {
    if (!key) {
      notify.warning('请先输入 API 密钥');
      return;
    }

    setTestingProvider(provider);
    try {
      const result = await validateApiKey(provider, key);
      if (result.isValid) {
        notify.success(`${PROVIDER_NAMES[provider]} API 密钥验证成功`);
      } else {
        notify.error(null, result.error || '验证失败');
      }
    } catch (error) {
      notify.error(error, '验证出错');
    } finally {
      setTestingProvider(null);
    }
  }, []);

  const toggleKeyVisibility = (provider: ModelProvider) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const providers: ModelProvider[] = Object.keys(MODEL_PROVIDERS) as ModelProvider[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Key size={16} />
          API 密钥管理
        </CardTitle>
        <Badge variant="secondary">安全存储</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-accent-primary/30 bg-accent-primary/10 px-4 py-3 text-sm">
          <p className="text-accent-primary font-medium">API 密钥仅存储在本地，不会上传到服务器</p>
        </div>

        <div className="space-y-4">
          {providers.map(provider => {
            const config = apiKeys[provider];
            const isVisible = visibleKeys.has(provider);
            const isTesting = testingProvider === provider;

            return (
              <div key={provider} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">{PROVIDER_NAMES[provider]}</label>
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <Input
                      type={isVisible ? 'text' : 'password'}
                      placeholder={`输入 ${PROVIDER_NAMES[provider]} API 密钥`}
                      value={config?.key || ''}
                      onChange={e => onUpdateKey(provider, e.target.value)}
                      aria-label={`${PROVIDER_NAMES[provider]} API 密钥输入框`}
                      className="pr-8"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {config?.isValid === true && <Check size={14} className="text-accent-success" />}
                      {config?.isValid === false && <X size={14} className="text-accent-danger" />}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => toggleKeyVisibility(provider)}
                    aria-label={isVisible ? "隐藏密钥" : "显示密钥"}
                  >
                    {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                  <Button
                    className="bg-accent-primary hover:bg-accent-primary-hover text-primary-foreground"
                    disabled={isTesting}
                    onClick={() => handleTest(provider, config?.key || '')}
                    aria-label={`验证 ${PROVIDER_NAMES[provider]} 密钥`}
                  >
                    {isTesting ? (
                      <><Loader2 size={14} className="mr-1 animate-spin" />验证中...</>
                    ) : (
                      '验证'
                    )}
                  </Button>
                  {config?.key && (
                    <Button
                      variant="destructive"
                      onClick={() => onDeleteKey(provider)}
                      aria-label={`删除 ${PROVIDER_NAMES[provider]} 密钥`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiKeysPanel;
