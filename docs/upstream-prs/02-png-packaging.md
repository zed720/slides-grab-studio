# fix(pkg): include `scripts/` in published files so `slides-grab png` works

> upstream: https://github.com/vkehfdl1/slides-grab

## 문제

`bin/ppt-agent.js` 가 `scripts/html2png.js` 를 require 하는데, npm 배포본의 `package.json#files` 에 `scripts/` 가 빠져 있어 설치 후 `slides-grab png` 명령 실행 시 module-not-found 로 즉시 실패합니다.

1.2.6 / 1.3.0 모두 같은 문제.

## 변경

`package.json#files` 에 `scripts` 디렉토리 추가.

```diff
   "files": [
     "bin",
+    "scripts",
     "src",
     ...
   ]
```

(정확한 키 이름과 위치는 현재 `package.json` 의 `files` 배열 확인 후 맞춰주세요.)

## 재현

```bash
npm install slides-grab
node node_modules/slides-grab/bin/ppt-agent.js png \
  --slides-dir output --output-dir out
# → Cannot find module '.../scripts/html2png.js'
```

## 결과 (예상)

- `slides-grab png` 가 cli/ npm 설치 사용자에게도 동작.
- bitreespark_II 의 임시 비활성 (`DISABLED_FORMATS = ["png"]`) 도 풀 수 있습니다.
