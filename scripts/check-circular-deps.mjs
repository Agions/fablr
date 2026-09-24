#!/usr/bin/env node
/**
 * check-circular-deps.mjs
 *
 * 检测 src/ 下的循环依赖（仅 ESM `import` 语句，不支持 CommonJS require）。
 *
 * 实现思路：
 *  1. 递归扫描 src/ 下所有 .ts/.tsx/.js/.jsx/.mjs 文件
 *  2. 用正则提取每个文件的所有 `import` 语句（包含 import type）
 *  3. 解析为相对路径，构建有向图
 *  4. DFS 检测环（白色/灰色/黑色染色）
 *
 * 退出码：
 *  - 0: 无循环依赖
 *  - 1: 发现循环依赖（输出所有环）
 *
 * Stage 8 PR-3.2 引入。无需第三方依赖（不依赖 madge / dpdm）。
 *
 * @author Fablr Refactor
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, resolve as pathResolve, dirname, basename, extname } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src'];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'reports', '__tests__']);

// ============================================================================
// 1. 收集所有源文件
// ============================================================================

const allFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (EXTENSIONS.includes(extname(entry))) {
      allFiles.push(full);
    }
  }
}

for (const dir of SCAN_DIRS) {
  const fullDir = pathResolve(ROOT, dir);
  if (existsSync(fullDir)) walk(fullDir);
}

// ============================================================================
// 2. 解析每个文件的 import 路径
// ============================================================================

// 匹配 import ... from 'path' / import 'path' / export ... from 'path' / dynamic import('path')
const IMPORT_RE = /(?:^|\s)(?:import\s+(?:[^'"`;]+\s+from\s+)?|export\s+(?:[^'"`;]+\s+from\s+)|import\s*\()\s*['"`]([^'"`]+)['"`]/g;

const graph = new Map(); // file -> Set<imported file (resolved)>

for (const file of allFiles) {
  const content = readFileSync(file, 'utf8');
  const imports = new Set();

  for (const m of content.matchAll(IMPORT_RE)) {
    const raw = m[1];
    // 跳过 node_modules / 路径别名（无法解析）
    if (raw.startsWith('@/') || raw.startsWith('node:')) continue;
    if (!raw.startsWith('.')) continue;

    // 解析相对路径
    const dir = dirname(file);
    let resolved = pathResolve(dir, raw);
    // 尝试加扩展名
    if (!extname(resolved)) {
      for (const ext of EXTENSIONS) {
        if (existsSync(resolved + ext)) {
          resolved = resolved + ext;
          break;
        }
      }
    }
    if (existsSync(resolved) && EXTENSIONS.includes(extname(resolved))) {
      imports.add(resolved);
    }
  }

  graph.set(file, imports);
}

// ============================================================================
// 3. DFS 检测环
// ============================================================================

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;
const color = new Map();
const cycles = [];

function dfs(node, path) {
  color.set(node, GRAY);
  path.push(node);

  for (const next of graph.get(node) ?? []) {
    const c = color.get(next) ?? WHITE;
    if (c === GRAY) {
      // 找到环
      const cycleStart = path.indexOf(next);
      const cycle = path.slice(cycleStart).map((p) => relative(ROOT, p));
      cycle.push(relative(ROOT, next));
      cycles.push(cycle);
    } else if (c === WHITE) {
      dfs(next, path);
    }
  }

  path.pop();
  color.set(node, BLACK);
}

for (const file of allFiles) {
  if ((color.get(file) ?? WHITE) === WHITE) {
    dfs(file, []);
  }
}

// ============================================================================
// 4. 报告
// ============================================================================

if (cycles.length === 0) {
  console.log('\x1b[32m✓\x1b[0m No circular dependencies found in src/');
  console.log(`  Scanned ${allFiles.length} files`);
  process.exit(0);
}

console.log('\x1b[31m✗\x1b[0m Found', cycles.length, 'circular dependency cycle(s):\n');
for (const [i, cycle] of cycles.entries()) {
  console.log(`  Cycle ${i + 1}:`);
  for (const file of cycle) {
    console.log('    →', file);
  }
  console.log('');
}
process.exit(1);
