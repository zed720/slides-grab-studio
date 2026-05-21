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
NODE_VERSION="20.18.0"
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
step "1/9 clean — dist/ 정리"
rm -rf "$DIST"
mkdir -p "$DIST"

# ── 2. install dependencies ───────────────────────────
step "2/9 install dependencies (frozen-lockfile, patch 자동 적용)"
pnpm install --frozen-lockfile

# ── 3. production build ───────────────────────────────
step "3/9 production build (next build → standalone)"
pnpm build

if [ ! -f ".next/standalone/server.js" ]; then
  echo "❌ standalone 빌드 실패 — .next/standalone/server.js 가 없음"
  exit 1
fi

# ── 4. Node binary 받기 ───────────────────────────────
step "4/9 Node v${NODE_VERSION} (darwin-${ARCH}) 받기"
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

echo "  └ slides-grab patch 적용 확인"
PATCHED_FILE="$RESOURCES/app/node_modules/slides-grab/src/editor/js/editor-select.js"
if [ -f "$PATCHED_FILE" ] && grep -q "bitreespark patch" "$PATCHED_FILE"; then
  echo "      ✓ slides-grab patch 적용됨"
else
  echo "      ⚠️  slides-grab patch 가 적용 안 된 것 같아요 (확인 필요)"
fi

# ── 6. Playwright Chromium ────────────────────────────
step "6/9 Playwright Chromium 받기 (~150MB, .app 안 직접)"
export PLAYWRIGHT_BROWSERS_PATH="$(cd "$RESOURCES" && pwd)/playwright-browsers"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
pnpm exec playwright install chromium

# ── 7. 빌드 산출물 정리 ───────────────────────────────
step "7/9 dev artifacts 제거"
rm -rf "$RESOURCES/app/data"        # 우리 dev 데이터
rm -rf "$RESOURCES/app/.next/cache" # build cache (런타임 불필요)
# package.json 의 devDependencies 가 standalone 에 안 들어가지만 한 번 더 확인
find "$RESOURCES/app/node_modules" -type d -name ".cache" -exec rm -rf {} + 2>/dev/null || true

# ── 8. code signing ──────────────────────────────────
step "8/9 ad-hoc codesign + quarantine 제거"
xattr -cr "$APP_PATH" 2>/dev/null || true
codesign --force --deep --sign - "$APP_PATH"
xattr -cr "$APP_PATH" 2>/dev/null || true

# ── 9. ZIP ───────────────────────────────────────────
step "9/9 ZIP 생성"
cd "$DIST"
rm -f "$ZIP_NAME"
zip -r -q "$ZIP_NAME" "$APP_NAME"
cd - >/dev/null

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
