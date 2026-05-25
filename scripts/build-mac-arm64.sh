#!/bin/bash
# Slides-Grab Studio — macOS Apple Silicon (arm64) 배포 빌드.
#
# 실행 결과:
#   dist/Slides-Grab Studio.app    — Node + standalone build + Chromium 모두 포함
#   dist/Slides-Grab-Studio-mac-arm64.zip
#
# 받는 사람은 zip 풀고 .app 더블클릭 (첫 회 우클릭→열기) 하면 끝.
# Node.js / pnpm / Playwright 설치 일절 불필요.

set -euo pipefail

cd "$(dirname "$0")/.."  # project root

# ── 설정 ────────────────────────────────────────────────
NODE_VERSION="22.20.0"   # v22 LTS — better-sqlite3 v12.10.0 의 prebuild 가 v22 (NODE_MODULE_VERSION 127) 부터 시작
ARCH="arm64"
DIST="dist"
APP_NAME="Slides-Grab Studio.app"
APP_PATH="$DIST/$APP_NAME"
ZIP_NAME="Slides-Grab-Studio-mac-${ARCH}.zip"

# 빌드 시작 시각 (소요 시간 측정용)
BUILD_START=$SECONDS

step() {
  echo ""
  echo "▶ $1"
}

# ── 1. clean ───────────────────────────────────────────
step "1/9 clean — dist/ 정리 (단 .node-cache 는 유지)"
# .node-cache 는 같은 Node version 받을 때 시간 절약 위해 보존.
if [ -d "$DIST/.node-cache" ]; then
  mv "$DIST/.node-cache" "/tmp/.slides-grab-node-cache-keep"
fi
rm -rf "$DIST"
mkdir -p "$DIST"
if [ -d "/tmp/.slides-grab-node-cache-keep" ]; then
  mv "/tmp/.slides-grab-node-cache-keep" "$DIST/.node-cache"
fi

# ── 2. Node binary 먼저 받기 ──────────────────────────
# 이게 step 2 인 이유: 번들된 Node v${NODE_VERSION} 로 install 해야 native binary
# (better-sqlite3 등) 가 같은 NODE_MODULE_VERSION 으로 컴파일됨. 시스템 Node 가
# 더 높은 버전이면 standalone 의 native binary 가 번들 Node 와 mismatch → 실패.
step "2/9 Node v${NODE_VERSION} (darwin-${ARCH}) 받기"
NODE_TARBALL="node-v${NODE_VERSION}-darwin-${ARCH}.tar.gz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"
NODE_CACHE="$DIST/.node-cache"
mkdir -p "$NODE_CACHE"
if [ ! -f "$NODE_CACHE/$NODE_TARBALL" ]; then
  echo "  내려받는 중 (~25MB)…"
  curl -fsSL -o "$NODE_CACHE/$NODE_TARBALL" "$NODE_URL"
else
  echo "  캐시 사용: $NODE_CACHE/$NODE_TARBALL"
fi
tar -xzf "$NODE_CACHE/$NODE_TARBALL" -C "$NODE_CACHE"
NODE_EXTRACTED="$NODE_CACHE/node-v${NODE_VERSION}-darwin-${ARCH}"

# 이 시점부터 모든 node/npm/pnpm 호출은 번들된 v${NODE_VERSION} 사용.
export PATH="$NODE_EXTRACTED/bin:$PATH"
echo "  사용 Node: $(node --version)  (path: $(command -v node))"

# ── 3. install dependencies (번들 Node 로) ────────────
step "3/9 clean install (번들 Node v${NODE_VERSION} 로 native 재컴파일)"
# 우리 환경의 pnpm 그대로 사용. native module 의 prebuild download / 컴파일은
# PATH 의 node 버전을 따름 → 번들 v20 용 binary 가 받혀짐 / 컴파일됨.
#
# 중요: node_modules 가 이미 있어도 (dev 흐름에서 시스템 Node v25 로 install
# 된 상태일 수 있음) frozen-lockfile 은 그걸 그대로 둠 → mismatch 사고.
# 우리는 그 디렉토리를 일단 비켜두고 clean install → 끝나면 복원.
DEV_MODULES_BACKUP=""
if [ -d "node_modules" ]; then
  DEV_MODULES_BACKUP="/tmp/.slides-grab-dev-modules-$$"
  echo "  기존 node_modules 를 잠시 비켜둠 ($DEV_MODULES_BACKUP)"
  mv node_modules "$DEV_MODULES_BACKUP"
fi

# Trap — 빌드 실패해도 dev 의 node_modules 복원.
restore_dev_modules() {
  if [ -n "$DEV_MODULES_BACKUP" ] && [ -d "$DEV_MODULES_BACKUP" ]; then
    echo "  dev node_modules 복원 중…"
    rm -rf node_modules
    mv "$DEV_MODULES_BACKUP" node_modules
  fi
}
trap restore_dev_modules EXIT

pnpm install --frozen-lockfile

# pnpm 의 store cache 가 PATH 의 Node 와 무관하게 이미 컴파일된 binary 를 hardlink
# 하기 때문에 PATH 만 바꿔서는 native (better-sqlite3 의 .node) 가 v20 으로
# 안 옴. 명시적 rebuild 로 PATH 의 번들 Node 기준 재컴파일 강제.
echo "  native 모듈을 번들 Node 로 재컴파일…"
pnpm rebuild

# ── 4. production build (번들 Node 로) ────────────────
step "4/9 production build (next build → standalone)"
pnpm build

if [ ! -f ".next/standalone/server.js" ]; then
  echo "❌ standalone 빌드 실패 — .next/standalone/server.js 가 없음"
  exit 1
fi

# ── 5. .app 구조 ──────────────────────────────────────
step "5/9 .app bundle 구조 만들기"
RESOURCES="$APP_PATH/Contents/Resources"
mkdir -p "$APP_PATH/Contents/MacOS" "$RESOURCES/app" "$RESOURCES/node-${ARCH}"

cp -p "Slides-Grab Studio.app/Contents/Info.plist" "$APP_PATH/Contents/Info.plist"
cp -p "Slides-Grab Studio.app/Contents/MacOS/SlidesGrabStudio" "$APP_PATH/Contents/MacOS/SlidesGrabStudio"
chmod +x "$APP_PATH/Contents/MacOS/SlidesGrabStudio"

echo "  ├ Node binary 복사"
cp -R "$NODE_EXTRACTED/bin" "$RESOURCES/node-${ARCH}/"
if [ -d "$NODE_EXTRACTED/lib" ]; then
  cp -R "$NODE_EXTRACTED/lib" "$RESOURCES/node-${ARCH}/"
fi

echo "  ├ Standalone build 복사 (server.js + node_modules)"
cp -R ".next/standalone/." "$RESOURCES/app/"
# .next/static 은 standalone 에 자동으로 포함되지 않아 별도 복사
mkdir -p "$RESOURCES/app/.next/static"
cp -R ".next/static/." "$RESOURCES/app/.next/static/"

echo "  ├ public/ 복사 (static assets)"
mkdir -p "$RESOURCES/app/public"
cp -R "public/." "$RESOURCES/app/public/"

echo "  ├ samples/ 복사 (환영 화면의 샘플 빠른 시작)"
mkdir -p "$RESOURCES/app/samples"
cp -R "samples/." "$RESOURCES/app/samples/"

# ── 6. Playwright Chromium (prune 전에 — playwright 는 devDep) ────
step "6/9 Playwright Chromium headless shell 받기 (.app 안 직접)"
# slides-grab 이 headless: true 로 launch 하므로 headless shell 만 있으면 충분.
# chromium 본체 (~340MB) + ffmpeg (~2.5MB) 안 받음 → zip 크기 약 400MB 절약.
export PLAYWRIGHT_BROWSERS_PATH="$(cd "$RESOURCES" && pwd)/playwright-browsers"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
pnpm exec playwright install chromium --only-shell

# ── 7. node_modules mirror + binary 교체 + 정리 ───────
step "7/9 node_modules mirror + better-sqlite3 binary 교체 + dev artifacts 제거"
echo "  ├ pnpm prune --prod 로 devDeps 제거 (Playwright install 끝났으므로 이제 빼도 OK)"
pnpm prune --prod

echo "  ├ cwd 의 안 들어있는 패키지만 standalone 에 overlay (전체 mirror 안 함 — 사이즈 절약)"
# Next standalone 의 traced node_modules 그대로 두고 (Next/React 등 traced 패키지),
# cwd 의 .pnpm 안 디렉토리 중 standalone 에 없는 것만 추가. slides-grab 와 그 의
# transitive deps (commander, pdf-lib, pptxgenjs, sharp, tldraw 등) 가 들어감.
# Next 본체는 standalone 이 자체 trace 한 minimal 만 유지 → 사이즈 절약.
APP_NM="$RESOURCES/app/node_modules"
mkdir -p "$APP_NM/.pnpm"
for src_dir in node_modules/.pnpm/*/; do
  pkg=$(basename "$src_dir")
  dst="$APP_NM/.pnpm/$pkg"
  # 일부 패키지는 standalone tracing 이 디렉토리는 가져오는데 native binary 등
  # 일부 파일을 빠뜨림. 디렉토리 존재 보고 skip 하면 그 파일들 안 들어감.
  # 다음 패턴은 항상 force overwrite (cwd 의 full 버전으로):
  #  - slides-grab@*           — bin/ 만 들어오고 src/ 빠짐
  #  - sharp@*                 — JS 는 들어오는데 의존 binary 로딩 실패
  #  - @img+sharp-*            — native .node binary 빠짐 (lib/ 비어있음)
  case "$pkg" in
    slides-grab@*|sharp@*|@img+sharp-*)
      rm -rf "$dst"
      cp -R "$src_dir" "$dst"
      ;;
    *)
      if [ ! -e "$dst" ]; then
        cp -R "$src_dir" "$dst"
      fi
      ;;
  esac
done
# top-level symlinks (slides-grab 같은 거) — standalone 에 없는 것만 add.
# .pnpm / .bin / .modules.yaml 같은 메타는 skip.
for src in node_modules/*; do
  name=$(basename "$src")
  case "$name" in
    .pnpm|.bin|.modules.yaml|.pnpm-workspace-state.json) continue ;;
  esac
  dst="$APP_NM/$name"
  if [ ! -e "$dst" ]; then
    cp -RP "$src" "$dst"
  fi
done

# pnpm store cache 가 hardlink 라 우리 PATH 의 번들 Node 와 무관하게 캐시된
# (시스템 Node 로 컴파일된) binary 가 들어감. better-sqlite3 의 GitHub release
# 에서 Node v22 (NODE_MODULE_VERSION 127) 용 prebuild binary 를 직접 받아 교체.
BSQLITE_VERSION="12.10.0"
NODE_ABI="127"  # Node v22 = NODE_MODULE_VERSION 127
echo "  ├ better-sqlite3 native binary 를 Node v${NODE_VERSION} (NODE_MODULE_VERSION ${NODE_ABI}) 용으로 교체"
BSQLITE_URL="https://github.com/WiseLibs/better-sqlite3/releases/download/v${BSQLITE_VERSION}/better-sqlite3-v${BSQLITE_VERSION}-node-v${NODE_ABI}-darwin-${ARCH}.tar.gz"
BSQLITE_TARGET="$RESOURCES/app/node_modules/.pnpm/better-sqlite3@${BSQLITE_VERSION}/node_modules/better-sqlite3"
BSQLITE_TMP="$DIST/.bsqlite-tmp"
rm -rf "$BSQLITE_TMP"
mkdir -p "$BSQLITE_TMP"
if curl -fsSL "$BSQLITE_URL" -o "$BSQLITE_TMP/prebuild.tar.gz"; then
  tar -xzf "$BSQLITE_TMP/prebuild.tar.gz" -C "$BSQLITE_TMP"
  if [ -f "$BSQLITE_TMP/build/Release/better_sqlite3.node" ]; then
    rm -rf "$BSQLITE_TARGET/build"
    mkdir -p "$BSQLITE_TARGET/build/Release"
    cp "$BSQLITE_TMP/build/Release/better_sqlite3.node" "$BSQLITE_TARGET/build/Release/"
    echo "      ✓ better_sqlite3.node (v${NODE_ABI}) 교체 완료"
  else
    echo "      ⚠️  prebuild tar 안 .node 파일 없음"
  fi
  rm -rf "$BSQLITE_TMP"
else
  echo "      ⚠️  prebuild download 실패: $BSQLITE_URL"
fi

echo "  ├ slides-grab patch 적용 확인"
PATCHED_FILE="$RESOURCES/app/node_modules/slides-grab/src/editor/js/editor-select.js"
if [ -f "$PATCHED_FILE" ] && grep -q "bitreespark patch" "$PATCHED_FILE"; then
  echo "      ✓ slides-grab patch 적용됨"
else
  echo "      ⚠️  slides-grab patch 가 적용 안 된 것 같아요 (확인 필요)"
fi

echo "  └ dev artifacts 제거"
rm -rf "$RESOURCES/app/data"        # 우리 dev 데이터
rm -rf "$RESOURCES/app/.next/cache" # build cache (런타임 불필요)
# Playwright 가 혹시 chromium 본체나 ffmpeg 까지 받으면 제거 (안전망).
# 주의: chromium-[숫자] 만 매치 (chromium_headless_shell-NNNN 는 _ 라 매치 X).
rm -rf "$PLAYWRIGHT_BROWSERS_PATH"/chromium-[0-9]* 2>/dev/null || true
rm -rf "$PLAYWRIGHT_BROWSERS_PATH"/ffmpeg-[0-9]* 2>/dev/null || true
find "$RESOURCES/app/node_modules" -type d -name ".cache" -exec rm -rf {} + 2>/dev/null || true

# ── 8. code signing ──────────────────────────────────
step "8/9 ad-hoc codesign + quarantine 제거"
xattr -cr "$APP_PATH" 2>/dev/null || true
codesign --force --deep --sign - "$APP_PATH"
xattr -cr "$APP_PATH" 2>/dev/null || true

# ── 9. ZIP (installer 와 함께 묶기) ──────────────────
step "9/9 ZIP 생성 (.app + 설치하기.command + 읽어보기.txt)"
# 압축을 풀면 'Slides-Grab Studio' 폴더 하나가 나오고 그 안에:
#   - Slides-Grab Studio.app
#   - 설치하기.command   (chmod +x — 우클릭→열기 후 자동 설치)
#   - 읽어보기.txt
# 이렇게 한 폴더로 묶는 이유: 압축 풀 때 사용자 Downloads 폴더에 파일 흩어지지 않게.
BUNDLE_DIR="$DIST/Slides-Grab Studio"
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"
mv "$APP_PATH" "$BUNDLE_DIR/$APP_NAME"

INSTALLER_TEMPLATE="scripts/installer-template"
cp "$INSTALLER_TEMPLATE/설치하기.command" "$BUNDLE_DIR/설치하기.command"
cp "$INSTALLER_TEMPLATE/읽어보기.txt" "$BUNDLE_DIR/읽어보기.txt"
chmod +x "$BUNDLE_DIR/설치하기.command"

# 묶음 전체에 quarantine 안 붙은 상태로 (어차피 다운로드 시점에 재부착되지만 일관성).
xattr -cr "$BUNDLE_DIR" 2>/dev/null || true

cd "$DIST"
rm -f "$ZIP_NAME"
zip -r -q "$ZIP_NAME" "Slides-Grab Studio"
cd - >/dev/null

# zip 안에 묶었으니 빌드 결과는 BUNDLE_DIR 기준으로 표시.
APP_PATH="$BUNDLE_DIR/$APP_NAME"

ZIP_SIZE=$(du -sh "$DIST/$ZIP_NAME" | awk '{print $1}')
APP_SIZE=$(du -sh "$APP_PATH" | awk '{print $1}')
ELAPSED=$((SECONDS - BUILD_START))

echo ""
echo "─────────────────────────────────────"
echo "✓ 빌드 완료 ($((ELAPSED / 60))분 $((ELAPSED % 60))초)"
echo "  .app:  $APP_PATH ($APP_SIZE)"
echo "  zip :  $DIST/$ZIP_NAME ($ZIP_SIZE)"
echo "─────────────────────────────────────"
echo ""
echo "다음 단계: $DIST/$ZIP_NAME 을 GitHub Release 에 올리거나"
echo "          친구/팀원에게 전달."
