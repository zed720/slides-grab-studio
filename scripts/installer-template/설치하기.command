#!/bin/bash
# Slides-Grab Studio — macOS 설치 스크립트
#
# 이 파일을 더블클릭(또는 우클릭→열기) 하면:
#   1) 다운로드 보호장치(quarantine) 풀고
#   2) /Applications/ 에 옮기고
#   3) 자동으로 실행해요.
#
# 두 번째부터는 런치패드 / Applications 에서 그냥 열면 됩니다.

set -e

cd "$(dirname "$0")"

APP_NAME="Slides-Grab Studio.app"

echo ""
echo "🎬 Slides-Grab Studio 설치"
echo "─────────────────────────────────────"

# ── 1. 같은 폴더에 .app 있는지 확인 ─────────────────
if [ ! -d "$APP_NAME" ]; then
  echo ""
  echo "⚠️  같은 폴더에 '$APP_NAME' 파일이 안 보여요."
  echo "   압축을 풀고 나서 이 파일을 실행해 주세요."
  echo ""
  read -p "확인했으면 Enter 키를 눌러 창을 닫아 주세요. "
  exit 1
fi

# ── 2. quarantine (다운로드 보호장치) 제거 ──────────
echo ""
echo "▶ 1/3 macOS 보호장치 해제 중…"
xattr -cr "$APP_NAME" 2>/dev/null || true
xattr -c "$0" 2>/dev/null || true
echo "  ✓ 완료"

# ── 3. /Applications/ 으로 이동 ──────────────────
echo ""
echo "▶ 2/3 /Applications/ 폴더로 옮기는 중…"

DEST="/Applications/$APP_NAME"

# 이미 있으면 덮어쓰기 (업데이트 시나리오)
if [ -d "$DEST" ]; then
  echo "  기존 버전이 있어 덮어씁니다."
  rm -rf "$DEST"
fi

# /Applications 이 쓰기 가능한지 (보통 OK, 가끔 권한 문제)
if cp -R "$APP_NAME" /Applications/ 2>/dev/null; then
  echo "  ✓ /Applications/$APP_NAME"
else
  echo "  ⚠️  /Applications/ 쓰기 권한 문제 — 비밀번호 입력 창이 뜰 수 있어요."
  sudo cp -R "$APP_NAME" /Applications/
  echo "  ✓ /Applications/$APP_NAME"
fi

# 옮긴 사본에 한 번 더 quarantine 제거 (안전망)
xattr -cr "$DEST" 2>/dev/null || true

# ── 4. 실행 ──────────────────────────────────────
echo ""
echo "▶ 3/3 앱 실행"
open "$DEST"

echo ""
echo "─────────────────────────────────────"
echo "✓ 설치 완료!"
echo ""
echo "  다음부터는 런치패드(F4) 또는 응용 프로그램 폴더에서"
echo "  'Slides-Grab Studio' 를 바로 열면 돼요."
echo ""
echo "  이 창은 닫아도 됩니다."
echo "─────────────────────────────────────"

# 3초 후 자동으로 터미널 창 닫기 시도 (사용자 친화)
sleep 3
osascript -e 'tell application "Terminal" to close (every window whose name contains "설치하기")' 2>/dev/null || true
