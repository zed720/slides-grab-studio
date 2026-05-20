#!/usr/bin/env bash
# Slides-Grab Web Studio — 더블클릭으로 켜기 (macOS)
# 이 파일을 더블클릭하면 터미널이 열리고 서버가 시작돼요.
# 끄려면 이 창에서 Ctrl+C 또는 창 닫기.

set -e

# 이 파일이 들어있는 폴더로 이동
cd "$(dirname "$0")"

# ── 출력 헬퍼 ──────────────────────────────────────
# 단계 헤더 — 진행 중인 작업이 무엇인지 한 줄.
step() {
  echo ""
  echo "▶ $1"
}

# 단계 끝 표시 + 소요 시간.
done_step() {
  local secs=$1
  local label=$2
  if [ "$secs" -ge 60 ]; then
    local mm=$((secs / 60))
    local ss=$((secs % 60))
    echo "  ✓ ${label} (${mm}분 ${ss}초)"
  else
    echo "  ✓ ${label} (${secs}초)"
  fi
}
# ────────────────────────────────────────────────

echo ""
echo "🎬 Slides-Grab Web Studio 켜는 중…"
echo "─────────────────────────────────────"

# ── 1. Node.js 확인 ────────────────────────────────
if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "⚠️  Node.js 가 아직 설치되지 않았어요."
  echo ""
  echo "   nodejs.org/ko 에서 LTS 버전을 받아 설치 후 다시 시도해 주세요."
  echo "   (README 의 '1-① Node.js 설치' 참고)"
  echo ""
  read -p "확인했으면 Enter 키를 눌러 창을 닫아 주세요. "
  exit 1
fi

# ── 2. pnpm 자동 설치 ──────────────────────────────
if ! command -v pnpm >/dev/null 2>&1; then
  step "패키지 도구 (pnpm) 받는 중… (약 30초)"
  SECONDS=0
  if ! npm install -g pnpm; then
    echo ""
    echo "⚠️  자동 설치에 실패했어요 (권한 문제일 수 있어요)."
    echo "   터미널에서 한 번만 실행해 주세요:"
    echo "       sudo npm install -g pnpm"
    echo ""
    read -p "확인했으면 Enter 키를 눌러 창을 닫아 주세요. "
    exit 1
  fi
  done_step $SECONDS "pnpm 설치 완료"
fi

# ── 3. 라이브러리 의존성 ────────────────────────────
if [ ! -d "node_modules" ]; then
  step "필요한 라이브러리 받는 중… (1~2분, 처음에만)"
  SECONDS=0
  pnpm install
  done_step $SECONDS "라이브러리 준비 완료"
fi

# ── 4. Chromium (PDF 만들기용) ─────────────────────
# Playwright Chromium 캐시 위치: ~/Library/Caches/ms-playwright/chromium-*
CHROMIUM_CACHE_GLOB="$HOME/Library/Caches/ms-playwright/chromium-"*
# shellcheck disable=SC2086
if ! ls -d $CHROMIUM_CACHE_GLOB >/dev/null 2>&1; then
  step "PDF 만들기에 필요한 Chromium 받는 중… (3~5분, ~150MB, 처음에만)"
  SECONDS=0
  pnpm exec playwright install chromium
  done_step $SECONDS "Chromium 준비 완료"
fi

# ── 5. 서버 시작 + 준비되면 브라우저 자동 open ──────
step "서버 시작 중… (첫 실행은 30초~1분)"
echo "  💡 끄려면 이 창에서 Ctrl+C 또는 창 닫기."
echo ""

# 브라우저 자동 open: localhost:3000 이 응답할 때까지 polling.
# 최대 2분 대기. 응답하면 즉시 open. timeout 이면 그냥 open 시도.
(
  for i in $(seq 1 60); do
    sleep 2
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "^[23]"; then
      echo ""
      echo "  ✓ 서버 준비 완료 — 브라우저 열어요."
      echo ""
      open "http://localhost:3000"
      exit 0
    fi
  done
  # timeout — 그래도 한 번 시도
  open "http://localhost:3000"
) &

pnpm dev
