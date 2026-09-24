/**
 * shared/tokens — Fablr 设计 Token 统一出口
 *
 * 架构定位：
 * - **真值**：CSS custom properties 定义于 `src/styles/globals.css :root`
 * - **运行时 fallback**：本目录（用于 SSR / Canvas / 跨窗口 IPC 等无 DOM 环境）
 * - **类型单一可信源**：本目录导出字面量联合类型供全局消费
 *
 * 注意事项：
 * - 新增 token 时同步：`globals.css` + `tailwind.config.ts` + 本目录
 */

export * from './color-tokens';
export * from './spacing-tokens';
export * from './size-tokens';
