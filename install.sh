#!/usr/bin/env bash
# Fablr One-Line Installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Agions/fablr/main/install.sh | bash -s -- 2.2.0
#
# Works on: macOS, Linux, Windows (Git Bash / WSL)

set -e

# ── Args ──────────────────────────────────────────
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "❌ 请指定版本号，例如:"
  echo "   curl -fsSL https://raw.githubusercontent.com/Agions/fablr/main/install.sh | bash -s -- 2.2.0"
  exit 1
fi

REPO="Agions/fablr"
INSTALL_DIR="${HOME}/Applications/Fablr.app"
TMPDIR="${TMPDIR:-/tmp}"
ARTIFACT_DIR="${TMPDIR}/fablr-install"

mkdir -p "$ARTIFACT_DIR"
cd "$ARTIFACT_DIR"

# ── Detect OS / Arch ──────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Linux*)     echo "linux" ;;
    Darwin*)    echo "macos" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)          echo "unknown" ;;
  esac
}

download() {
  local artifact_path="$1"
  local filename="$2"
  local url="https://github.com/${REPO}/releases/download/${VERSION}/${artifact_path}"

  echo "⬇️  下载 $filename..."
  if ! curl -fLo "${ARTIFACT_DIR}/${filename}" -H "Accept: application/octet-stream" "$url"; then
    return 1
  fi
}

install_macos() {
  local dmg="${ARTIFACT_DIR}/Fablr.dmg"
  download "Fablr_${VERSION}_aarch64.dmg" "Fablr.dmg" || \
  download "Fablr_${VERSION}_x64.dmg" "Fablr.dmg" || \
  download "Fablr.dmg" "Fablr.dmg" || {
    echo "❌ 下载 macOS 安装包失败"
    exit 1
  }

  echo "📦 挂载 DMG..."
  hdiutil attach "$dmg" -mountpoint /Volumes/Fablr -nobrowse

  echo "🧹 移除旧版..."
  rm -rf "$INSTALL_DIR"

  echo "📦 复制到 Applications..."
  cp -r /Volumes/Fablr/Fablr.app "$INSTALL_DIR"

  hdiutil detach /Volumes/Fablr
  rm -f "$dmg"

  echo "✅ 安装完成: ${INSTALL_DIR}"
  echo "   启动: open \"${INSTALL_DIR}\""
}

install_linux_appimage() {
  local appimage="${ARTIFACT_DIR}/Fablr.AppImage"
  download "Fablr_${VERSION}_amd64.AppImage" "Fablr.AppImage" || \
  download "Fablr.AppImage" "Fablr.AppImage" || {
    echo "❌ 下载 Linux AppImage 失败"
    exit 1
  }

  chmod +x "$appimage"

  BIN_DIR="${HOME}/.local/bin"
  mkdir -p "$BIN_DIR"
  mv "$appimage" "${BIN_DIR}/fablr"

  echo "✅ 安装完成: ${BIN_DIR}/fablr"
  echo "   运行: ${BIN_DIR}/fablr"
}

install_linux_deb() {
  local deb="${ARTIFACT_DIR}/fablr.deb"
  download "fablr_${VERSION}_amd64.deb" "fablr.deb" || \
  download "fablr.deb" "fablr.deb" || {
    echo "❌ 下载 Linux deb 包失败"
    exit 1
  }
  sudo dpkg -i "$deb" || sudo apt-get -f install -y
  rm -f "$deb"
  echo "✅ 安装完成"
}

install_windows() {
  local exe="${ARTIFACT_DIR}/Fablr-setup.exe"
  download "Fablr_${VERSION}_x64-setup.exe" "Fablr-setup.exe" || \
  download "Fablr-setup.exe" "Fablr-setup.exe" || {
    echo "❌ 下载 Windows 安装包失败"
    exit 1
  }
  echo "📦 运行安装程序: $exe"
  powershell -Command "Start-Process -FilePath '$exe' -Wait"
  echo "✅ 安装完成"
}

# ── Main ──────────────────────────────────────────
main() {
  local os=$(detect_os)
  echo "🖥️  系统: ${os}"
  echo "📦 版本: ${VERSION}"

  case "$os" in
    macos)  install_macos ;;
    linux)
      if command -v dpkg >/dev/null 2>&1; then
        install_linux_deb
      else
        install_linux_appimage
      fi
      ;;
    windows) install_windows ;;
    *)      echo "❌ 不支持的操作系统: ${os}" ; exit 1 ;;
  esac
}

main
