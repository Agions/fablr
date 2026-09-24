#!/usr/bin/env node
/**
 * check-naming.mjs
 *
 * Fablr 前端命名规范校验脚本（阶段0 重写版）。
 *
 * 扫描范围（仅前端 `src`）：
 *   1. 文件名 kebab-case        ：^[a-z][a-z0-9-]*$
 *   2. 角色后缀拍平（role-suffix-flatten，仅限无工具链依赖的语义后缀）：
 *        *.reducer.ts / *.reducer.test.ts / *.service.ts / *.types.ts
 *        应拍平为 name-role.ext（例如 commentary-panel.reducer.ts →
 *        commentary-panel-reducer.ts）。
 *        注意：*.module.less（Vite CSS Module 契约）与 *.test.ts(x) /
 *        *.spec.ts(x)（Vitest 测试发现契约）必须保留原后缀，不可拍平。
 *   3. 目录名 kebab-case         ：纯小写 + 连字符，禁用 PascalCase/camelCase/下划线
 *                                  通用目录白名单豁免；禁止目录名升级为 error 级
 *
 * 显式排除（绝不扫描其子树）：
 *   src-tauri / node_modules / dist / target / build / .git / coverage /
 *   reports / docs / scripts / public / assets / styles
 *
 * 退出码恒为 0 —— 仅报告，不阻塞 CI。但会列出完整违规清单（不再输出空 “✓ 通过”）。
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOT = join(ROOT, 'src');

/** 绝不扫描的目录（命中即跳过，不会进入子树） */
const EXCLUDE_DIRS = new Set([
  'src-tauri',
  'node_modules',
  'dist',
  'target',
  'build',
  '.git',
  'coverage',
  'reports',
  'docs',
  'scripts',
  'public',
  'assets',
  'styles',
]);

/** 绝不扫描的文件（macOS 隐藏文件等） */
const EXCLUDE_FILES = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep']);

/** 既有通用目录白名单：名字本身不报违规（其内部仍会被扫描） */
const DIR_WHITELIST = new Set([
  'ui',
  'common',
  'shared',
  'core',
  'stores',
  'hooks',
  'pages',
  'components',
  'providers',
  'types',
  'styles',
  'test',
  // Vitest/测试工具链约定目录（双下划线包裹），保留原名。
  '__tests__',
  '__bench__',
  '__mocks__',
  'node_modules',
]);

/** 语义模糊 / 不推荐的目录名：升级为 error 级提示 */
const FORBIDDEN_DIRS = new Set([
  'util',
  'helper',
  'helpers',
  'misc',
  'tmp',
  'temp',
  'new',
  'old',
  'v2',
]);

/** 文件名完全例外（不报违规） */
const FILE_EXACT_EXCEPTIONS = new Set(['main.tsx', 'App.tsx']);

/**
 * PascalCase icon 文件模式（项目惯例，与 lucide-react 风格一致）。
 * 形如 `FilmIcon.tsx` / `PlayCircleIcon.tsx` 这类命名保留原名。
 */
const PASCAL_ICON_RE = /^[A-Z][A-Za-z0-9]*Icon\.tsx$/;

/**
 * 工具链后缀（必须保留，不可拍平）：
 *   - Vitest 测试发现：*.test.ts(x) / *.spec.ts(x) / *.bench.ts
 *   - Vite CSS Module：*.module.less / *.module.css
 *   - 类型声明：*.d.ts
 * 改名会破坏构建/测试，故不纳入拍平。
 */
const TOOLING_SUFFIXES = [
  '.test.tsx',
  '.test.ts',
  '.spec.tsx',
  '.spec.ts',
  '.bench.ts',
  '.bench.tsx',
  '.module.less',
  '.module.css',
  '.d.ts',
];

/**
 * 可拍平的角色标记（仅语义后缀，无工具链依赖）：
 *   .reducer / .service / .types
 * 命中后把名字里的 "." 替换为 "-" 并保留工具链后缀。
 */
const ROLE_MARKERS = ['.reducer', '.service', '.types'];

const KEBAB_RE = /^[a-z][a-z0-9-]*$/;

const C_RESET = '\x1b[0m';
const C_RED = '\x1b[31m';
const C_YELLOW = '\x1b[33m';
const C_CYAN = '\x1b[36m';
const C_GRAY = '\x1b[90m';

/**
 * 判断字符串是否符合 kebab-case。
 * @param {string} name
 * @returns {boolean}
 */
function isKebabCase(name) {
  return KEBAB_RE.test(name);
}

/**
 * 解析文件名。
 * @param {string} fname
 * @returns {{ base: string, ext: string, isException: boolean, role: string | null }}
 *   - isException：完全例外（index.* / *.d.ts / main.tsx / App.tsx）
 *   - role      ：命中的角色后缀（无则 null）
 */
function parseFileName(fname) {
  if (FILE_EXACT_EXCEPTIONS.has(fname)) {
    return { core: fname, tooling: '', isException: true, role: null };
  }
  // 提取工具链后缀（若有）：*.test.ts(x) / *.spec.ts(x) / *.module.less /
  // *.module.css / *.d.ts —— 这些必须保留，不可拍平
  let tooling = '';
  for (const suf of TOOLING_SUFFIXES) {
    if (fname.endsWith(suf)) {
      tooling = suf;
      break;
    }
  }
  const beforeTooling = tooling ? fname.slice(0, fname.length - tooling.length) : fname;
  // 去掉真正的扩展名（最后一个点之后），得到名字部分（角色标记如 .reducer 保留在点内）
  const lastDot = beforeTooling.lastIndexOf('.');
  const nameOnly = lastDot > 0 ? beforeTooling.slice(0, lastDot) : beforeTooling;
  if (nameOnly === 'index') {
    // index.* 例外（入口文件，含 index.module.less 等）
    return { core: 'index', tooling, isException: true, role: null };
  }
  // 检查可拍平的角色标记（.reducer / .service / .types）
  let role = null;
  for (const marker of ROLE_MARKERS) {
    if (nameOnly.endsWith(marker)) {
      role = marker;
      break;
    }
  }
  return { core: nameOnly, tooling, isException: false, role };
}

/** 文件名 kebab 违规 */
const fileViolations = [];
/** 目录名违规（含 error 级的 forbidden） */
const dirViolations = [];
/** 角色后缀拍平 */
const roleViolations = [];

/**
 * 检查目录名并记录违规。
 * @param {string} dirName
 * @param {string} relPath 相对于 ROOT 的路径
 */
function checkDirName(dirName, relPath) {
  if (DIR_WHITELIST.has(dirName)) return;
  if (FORBIDDEN_DIRS.has(dirName)) {
    dirViolations.push({
      level: 'error',
      path: relPath,
      msg: `禁止的目录名 "${dirName}" — 请使用具体语义命名（如 utils/、formats/），避免模糊词`,
    });
    return;
  }
  if (!isKebabCase(dirName)) {
    dirViolations.push({
      level: 'warn',
      path: relPath,
      msg: `目录名 "${dirName}" 应改为 kebab-case（纯小写 + 连字符，禁用 PascalCase/camelCase/下划线）`,
    });
  }
}

/**
 * 校验单个文件。
 * @param {string} fname
 * @param {string} relPath
 */
function checkFile(fname, relPath) {
  if (EXCLUDE_FILES.has(fname)) return;
  const { core, tooling, isException, role } = parseFileName(fname);
  if (isException) return;
  // PascalCase icon 文件（项目惯例，不报错）。
  if (PASCAL_ICON_RE.test(fname)) return;

  // 角色标记（.reducer / .service / .types）→ 拍平为 kebab，保留工具链后缀
  if (role) {
    const flattened = `${core.replace(/\./g, '-')}${tooling}`;
    roleViolations.push({
      path: relPath,
      msg: `角色后缀文件应拍平为 kebab，例如 ${fname} → ${flattened}`,
    });
    return;
  }

  // 普通文件（含 *.module.less / *.test.ts(x) / *.bench.ts 等工具链后缀文件）→ kebab 检查 core
  if (!isKebabCase(core)) {
    fileViolations.push({
      path: relPath,
      msg: `文件名 "${fname}" 不符合 kebab-case（应为纯小写 + 连字符，如 my-component.ts）`,
    });
  }
}

/**
 * 递归遍历 src，执行文件 / 目录校验。
 * @param {string} absDir
 * @param {string} relDir
 */
function walk(absDir, relDir) {
  let entries;
  try {
    entries = readdirSync(absDir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const absPath = join(absDir, name);
    let st;
    try {
      st = statSync(absPath);
    } catch {
      continue;
    }
    const relPath = relDir ? `${relDir}${sep}${name}` : name;
    if (st.isDirectory()) {
      checkDirName(name, relPath);
      walk(absPath, relPath);
    } else if (st.isFile()) {
      checkFile(name, relPath);
    }
  }
}

// ─── 执行 ───────────────────────────────────────────────────────────────────
walk(SCAN_ROOT, 'src');

// ─── 输出 ─────────────────────────────────────────────────────────────────────
/**
 * @param {string} title
 * @param {Array<{ path: string, msg: string, level?: string }>} items
 * @param {string} color
 */
function printGroup(title, items, color) {
  console.log(`\n${color}${title}（${items.length}）${C_RESET}`);
  if (items.length === 0) {
    console.log(`${C_GRAY}  （无）${C_RESET}`);
    return;
  }
  for (const it of items) {
    const tag = it.level === 'error' ? `${C_RED}[error]${C_RESET} ` : '';
    console.log(`  ${tag}${it.path}`);
    console.log(`    ${C_GRAY}${it.msg}${C_RESET}`);
  }
}

console.log(`${C_CYAN}Fablr 命名规范校验（仅报告，不阻塞 CI）${C_RESET}`);
console.log(`${C_GRAY}扫描根: ${SCAN_ROOT}${C_RESET}`);

printGroup('① 文件命名违规（kebab-case）', fileViolations, C_YELLOW);
printGroup('② 目录命名违规', dirViolations, C_YELLOW);
printGroup('③ 角色后缀拍平（role-suffix-flatten）', roleViolations, C_YELLOW);

const total = fileViolations.length + dirViolations.length + roleViolations.length;
const errorCount = dirViolations.filter(v => v.level === 'error').length;

console.log(`\n${C_CYAN}==== 汇总 ====${C_RESET}`);
console.log(`  文件命名违规 : ${fileViolations.length}`);
console.log(`  目录命名违规 : ${dirViolations.length}（其中 error 级 ${errorCount}）`);
console.log(`  角色后缀拍平 : ${roleViolations.length}`);
console.log(`  ${C_YELLOW}合计待整改: ${total}${C_RESET}`);
console.log(`${C_GRAY}规范详情见 docs/developer/02-testing-and-standards.md${C_RESET}`);

process.exit(0);
