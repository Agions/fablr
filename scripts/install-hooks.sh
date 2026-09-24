#!/usr/bin/env bash
# install-hooks.sh — 安装 Fablr git hooks
# 使用: bash scripts/install-hooks.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

HOOKS_SRC="scripts/hooks"
HOOKS_DST=".git/hooks"

echo "📦 安装 git hooks..."

for hook_file in "$HOOKS_SRC"/*; do
  if [ -f "$hook_file" ]; then
    hook_name=$(basename "$hook_file")
    target="$HOOKS_DST/$hook_name"
    cp "$hook_file" "$target"
    chmod +x "$target"
    echo "  ✓ $hook_name"
  fi
done

echo ""
echo "✅ hooks 安装完成"
echo ""
echo "已启用:"
echo "  - pre-commit: 校验全局账户 + 禁 antd + AI byline 检查"
echo ""
echo "卸载: rm .git/hooks/pre-commit"
