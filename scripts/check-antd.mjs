#!/usr/bin/env node
/**
 * check-antd.mjs
 *
 * Fablr 项目级约束：UI 层严禁使用 antd 及其兼容设计。
 * (出处: ADR-002, 用户明确要求)
 *
 * 此脚本扫描 src/ 中所有 .ts/.tsx/.js/.jsx 文件，检测：
 *  1. import 'antd'           (直接)
 *  2. import '@ant-design/*'  (子包)
 *  3. require('antd')         (CommonJS)
 *  4. dynamic import('antd')  (字符串)
 *
 * 退出码：
 *  - 0: 未发现 antd
 *  - 1: 发现 antd 引用
 *
 * @author Agions <1051736049@qq.com>
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'reports']);

// antd 相关 pattern
const PATTERNS = [
  /from\s+['"]antd['"]/,
  /from\s+['"]@ant-design\//,
  /require\(['"]antd['"]\)/,
  /import\s*\(\s*['"]antd['"]\s*\)/,
  /import\s*\(\s*['"]@ant-design\//,
];

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const violations = [];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      yield* walk(p);
    } else if (st.isFile()) {
      const ext = name.slice(name.lastIndexOf('.'));
      if (EXTENSIONS.has(ext)) yield p;
    }
  }
}

for (const dir of SCAN_DIRS) {
  const full = join(ROOT, dir);
  try {
    statSync(full);
  } catch {
    continue;
  }
  for (const file of walk(full)) {
    const text = readFileSync(file, 'utf-8');
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      // 跳过注释行
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return;
      }
      for (const pat of PATTERNS) {
        if (pat.test(line)) {
          violations.push({
            file: relative(ROOT, file).split(sep).join('/'),
            line: idx + 1,
            snippet: line.trim().slice(0, 120),
            pattern: pat.toString(),
          });
          break;
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error(`${RED}✗ 检测到 antd 引用 (${violations.length} 处)${RESET}`);
  console.error(`${YELLOW}Fablr 规定: UI 层严禁使用 antd 及其兼容设计${RESET}\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.snippet}\n`);
  }
  console.error(`${YELLOW}请改用 shadcn/ui 组件 (@/components/ui/*)${RESET}`);
  console.error(`参考 ADR-002: shadcn/ui 作为 UI 唯一基座`);
  process.exit(1);
}

console.log(`${GREEN}✓ check-antd 通过: 未发现 antd 引用${RESET}`);
process.exit(0);
