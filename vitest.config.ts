/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: ['node_modules', 'dist', '.git', 'src/test/**/fixtures/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: ['node_modules', 'src/test', '**/*.d.ts', '**/*.config.*', '**/vite-env.d.ts'],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: {
        // 覆盖率梯度（5% 步进，原 5->15->30->50->65->80 6 步跨度过大，CI 频繁红）
        // 实际覆盖率（2026-08-06，PR-M2.11 完成后）：
        //   Statements: 55.04%   Branches: 46.97%   Functions: 53.02%   Lines: 56.32%
        // PR-M2.11 门槛：Statements 55% / Branches 46% / Functions 53% / Lines 56%
        // 下一档目标：继续向全局 57% 推进 — 详见 docs/TECH_DEBT.md §3
        // 重点：覆盖率提升 = 核心业务（hooks/stores/service）优先，UI 组件延后。
        // 152 test files / 459 source files，持续补单元测试而非仅提门槛。
        // PR-M2.11 新增：
        //   - src/core/services/pipeline/clip-pipeline/clip-scorer.ts (24 tests)
        //   - src/core/services/pipeline/clip-pipeline/seo-generator.ts (23 tests)
        //   - src/core/services/pipeline/clip-pipeline/multi-export.ts (24 tests)
        //   - src/core/services/pipeline/clip-pipeline/pipeline.ts (15 tests)
        //   - src/core/services/asr/providers/web-speech-provider.ts (17 tests)
        //   - src/app.tsx (15 tests)
        // PR-M2.12 门槛：Statements 57% / Branches 48% / Functions 55% / Lines 58%
        // PR-M2.12 新增：
        //   - src/core/services/ai/voice-synthesis-service.ts (synthesizeToBuffer / synthesizeAndSave)
        //   - src/core/services/commentary/pipeline-service.ts (3 listener callbacks)
        //   - src/shared/errors/app-error.ts (构造函数 / toJSON / from)
        //   - src/stores/create-persisted-store.ts (默认/自定义 storage + partialize)
        //   - src/core/services/subtitle/whisper-service.ts (onProgress + listen 错误路径)
        //   - src/core/services/export/export-service.ts (active export cancel + presets/info)
        //   - src/shared/utils/project-utils.ts (updateProject / getStatusColor / starred/tags/description)
        //   - src/core/tauri/invoke.ts (TauriBridgeError.fromInvoke + retry + abort + runCommentaryPipeline)
        // PR-M2.13 门槛：Statements 58% / Branches 49% / Functions 56% / Lines 59%
        // PR-M2.13 新增（全部 → 100%）：
        //   - src/core/services/project/project-file-service.ts (81% → 100%)
        //   - src/core/services/commentary/types.ts (55% → 100%)
        //   - src/core/services/subtitle/providers/subtitle-asr.ts (66% → 100%)
        //   - src/core/services/ai/vision/scene-detection-service.ts (86% → 100%)
        //   - src/core/video/base-video-processor.ts (86% → 100%)
        //   - src/core/services/video/transition-suggestion.ts (85.71% → 100%)
        // 6 个文件全部补到 100%；全局 Stmts/Branch/Funcs/Lines 较 PR-M2.12 提升 +1% 门槛。
        // PR-M2.14 新增（dead-code-only / 接近 100%）：
        //   - src/hooks/use-commentary-voice.ts (80% → 100%)
        //   - src/core/services/ai/ai-model-configs.ts (90% → 100%)
        //   - src/core/services/ai/ai-service.ts (97.62% → dead-code-only)
        // PR-M2.15 新增（dead-code-only / 接近 100%）：
        //   - src/hooks/use-keyboard-shortcuts.ts (94.94% → L115 dead-code-only)
        // PR-M2.16 新增（全部 → 100%）：
        //   - src/hooks/use-local-storage.ts (94.12% → 100%)
        //   - src/core/services/ai/script/ai-api-client.ts (96.77% → 100%)
        //   - src/core/services/asr/asr-service.ts (97.06% → 100%)
        //   - src/hooks/use-script-editor.ts (97.80% → dead-code-only)
        //   - src/hooks/use-project-list.ts (98.80% → 100%)
        //   - src/core/services/asr/providers/whisper-rust-provider.ts (未覆盖 → 100%, 新增测试)
        // PR-M2.16 门槛：Statements 59% / Branches 50% / Functions 56% / Lines 60%
        // PR-M2.17 门槛：Statements 59% / Branches 51% / Functions 56% / Lines 60%
        // PR-M2.18 门槛：Statements 59% / Branches 51% / Functions 57% / Lines 60%
        // 实际覆盖率（2026-08-08，PR-M2.18 完成后）：
        //   Statements: 59.20%   Branches: 51.29%   Functions: 57.03%   Lines: 60.07%
        // PR-M2.19/20/21 新增：
        //   - src/core/tauri/methods/mix-audio.ts (33% → 100%)
        //   - src/core/services/file/file-info-service.ts (0% → 100%)
        //   - src/core/video/tauri-video-processor.ts (92% → 96%, fn 7 / stmt 15)
        //   - src/core/video/tauri-video-processor.ts (L61 framePaths.map dead-code 接受注释)
        // PR-M2.23 新增（全部 → 100%）：
        //   - src/core/tauri/methods/tts.ts (20% → 100%)
        //   - src/core/tauri/methods/ai-script.ts (25% → 100%)
        //   - src/core/tauri/methods/video-analysis.ts (25% → 100%)
        // PR-M2.24 新增（全部 → 100%）：
        //   - src/core/tauri/methods/file-operations.ts (12.5% → 100%)
        //   - src/core/tauri/methods/render-transcode.ts (14.3% → 100%)
        //   - src/core/tauri/methods/highlight-detection.ts (9.1% → 100%)
        // PR-M2.26/27 新增（全部 → 100%）：
        //   - src/core/tauri/methods/project.ts (12.5% → 100%, 7 fns)
        //   - src/core/tauri/methods/commentary.ts (14.3% → 100%, 12 fns)
        // 实际覆盖率（2026-08-08，PR-M2.27 完成后）：
        //   Statements: 60.04%   Branches: 51.52%   Functions: 59.10%   Lines: 60.97%
        statements: 59,
        branches: 50,
        functions: 58,
        lines: 59,
      },
    },
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/store': path.resolve(__dirname, './src/stores'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/shared/constants': path.resolve(__dirname, './src/shared/constants'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/context': path.resolve(__dirname, './src/context'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/styles': path.resolve(__dirname, './src/styles'),
    },
  },
});
