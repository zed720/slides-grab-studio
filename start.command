#!/usr/bin/env bash
# Slides-Grab Web Studio — 더블클릭으로 켜기 (macOS)
# 이 파일을 더블클릭하면 터미널이 열리고 서버가 시작돼요.
# 끄려면 이 창에서 Ctrl+C 또는 창 닫기.

set -e

# 이 파일이 들어있는 폴더로 이동
cd "$(dirname "$0")"

echo ""
echo "🎬 Slides-Grab Web Studio 켜는 중…"
echo "─────────────────────────────────────"
echo ""

# Node.js (npm) 있는지 확인 — 이건 사용자가 직접 설치해야 함 (GUI .pkg)
if ! command -v npm >/dev/null 2>&1; then
  echo "⚠️  Node.js 가 아직 설치되지 않았어요."
  echo ""
  echo "   nodejs.org/ko 에서 LTS 버전을 받아 설치 후 다시 시도해 주세요."
  echo "   (README 의 '1-① Node.js 설치' 참고)"
  echo ""
  read -p "확인했으면 Enter 키를 눌러 창을 닫아 주세요. "
  exit 1
fi

# pnpm 자동 설치 — 사용자가 터미널에 직접 칠 명령 줄이기
if ! command -v pnpm >/dev/null 2>&1; then
  echo "📦 패키지 도구 (pnpm) 자동 설치 중…"
  if ! npm install -g pnpm 2>&1; then
    echo ""
    echo "⚠️  자동 설치에 실패했어요 (권한 문제일 수 있어요)."
    echo "   터미널에서 한 번만 실행해 주세요:"
    echo "       sudo npm install -g pnpm"
    echo ""
    read -p "확인했으면 Enter 키를 눌러 창을 닫아 주세요. "
    exit 1
  fi
  echo "   ✓ pnpm 설치 완료"
  echo ""
fi

# 의존성이 아직 깔리지 않았으면 자동으로 받아옴
if [ ! -d "node_modules" ]; then
  echo "📦 처음이라 부품들을 받아올게요 (5~10분 걸려요)…"
  echo "   - 라이브러리 의존성"
  echo "   - PDF 만들기에 필요한 Chromium (~150MB)"
  echo ""
  pnpm install
  pnpm exec playwright install chromium
  echo ""
fi

echo "🚀 서버 시작! 잠시 후 브라우저가 자동으로 열려요."
echo "   (창을 닫거나 Ctrl+C 하면 서버가 꺼져요.)"
echo ""

# 서버 시작 + 잠시 후 브라우저 자동 열기 (background)
(sleep 3 && open "http://localhost:3000") &

pnpm dev
