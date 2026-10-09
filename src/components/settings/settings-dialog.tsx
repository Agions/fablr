/**
 * SettingsDialog — 设置对话框
 * shadcn Dialog, 640px wide
 * 4 tabs: AI | Appearance | Shortcuts | Export
 *
 * AI Tab 内包含:
 *   - AISettings        — 默认模型选择 + API Key 快速验证
 *   - ApiKeysPanel      — 多 Provider API Keys 管理（增删改查）
 */
import React, { memo, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { AISettings } from './ai-settings';
import ApiKeysPanel from './api-keys-panel';
import { AppearanceSettings } from './appearance-settings';
import { ShortcutSettings } from './shortcut-settings';
import { ExportSettings } from './export-settings';
import { AI_MODELS } from '@/core/config/ai-models-config';
import type { ModelProvider } from '@/types';
import { notify } from '@/shared';
import { validateApiKey } from '@/core/services/providers/api-key-validator';
import { useSecureApiKeys } from '@/hooks/use-secure-api-keys';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabKey = 'ai' | 'appearance' | 'shortcuts' | 'export';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'ai', label: 'AI' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'shortcuts', label: 'Shortcuts' },
  { key: 'export', label: 'Export' },
];

// ─── AI Tab 内容 ───────────────────────────────────────────────

const AITabContent: React.FC = () => {
  const [apiKeys, setApiKeys] = useSecureApiKeys({});
  const [defaultModel, setDefaultModel] = useState('gpt-5.5');

  // 当前选中模型对应的 provider 和 apiKey
  const selectedModel = AI_MODELS.find(m => m.id === defaultModel);
  const selectedProvider = selectedModel?.provider as ModelProvider | undefined;
  const currentApiKey = selectedProvider ? apiKeys[selectedProvider]?.key ?? '' : '';

  // 更新单个 provider 的 API Key（含验证）
  const handleUpdateKey = useCallback(async (provider: ModelProvider, key: string) => {
    const newKeys = { ...apiKeys };

    if (!key.trim()) {
      delete newKeys[provider];
    } else {
      newKeys[provider] = { key, isValid: undefined };
    }
    await setApiKeys(newKeys);

    // 异步验证
    if (key.trim()) {
      const result = await validateApiKey(provider, key);
      await setApiKeys(prev => ({
        ...prev,
        [provider]: { key, isValid: result.isValid },
      }));
      if (!result.isValid) {
        notify.error(null, `${provider} 密钥验证失败：${result.error}`);
      }
    }
  }, [apiKeys, setApiKeys]);

  // 删除某个 provider 的 API Key
  const handleDeleteKey = useCallback(async (provider: ModelProvider) => {
    await setApiKeys(prev => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
    notify.success('已删除该 API Key');
  }, [setApiKeys]);

  // 默认模型切换时，同步 API Key 输入框显示对应的 key
  const handleModelChange = useCallback((modelId: string) => {
    setDefaultModel(modelId);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* 默认模型 + 快速验证 */}
      <AISettings
        apiKey={currentApiKey}
        model={defaultModel}
        onApiKeyChange={(key) => {
          if (selectedProvider) {
            handleUpdateKey(selectedProvider, key);
          }
        }}
        onModelChange={handleModelChange}
      />

      {/* 多 Provider API Keys 完整管理 */}
      <ApiKeysPanel
        apiKeys={apiKeys}
        onUpdateKey={handleUpdateKey}
        onDeleteKey={handleDeleteKey}
      />
    </div>
  );
};

// ─── 主组件 ───────────────────────────────────────────────────
export const SettingsDialog = memo<SettingsDialogProps>(({ open, onOpenChange }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('ai');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full" style={{ maxWidth: 640, backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-text-primary">
            Settings
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border-subtle mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px
                ${activeTab === tab.key
                  ? 'border-accent-primary text-accent-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-default'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          {activeTab === 'ai' && <AITabContent />}
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'shortcuts' && <ShortcutSettings />}
          {activeTab === 'export' && <ExportSettings />}
        </div>
      </DialogContent>
    </Dialog>
  );
});

SettingsDialog.displayName = 'SettingsDialog';
