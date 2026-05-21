# feat(editor): in-place contentEditable text editing with inline child preservation

> upstream: https://github.com/vkehfdl1/slides-grab
> 이 본문은 PR description 으로 그대로 복사해 쓰면 돼요.

## 문제

`slides-grab edit` 의 현재 텍스트 편집 흐름:

1. 사용자가 슬라이드 안 텍스트 element 클릭 → editor 가 sidebar 에 `popoverTextInput` 보여줌
2. 사용자가 sidebar 의 input 에 새 텍스트 입력 → 적용

이 구조에 두 가지 한계:

- **inline 자식 평탄화** — sidebar input 은 plain text 라 적용 시 `<h1>` / `<p>` 의 innerHTML 이 평탄한 텍스트로 덮어써짐. 즉 디자인에 사용된 `<span>` 색깔, `<strong>` 굵기 같은 inline 자식 구조가 사라짐.
- **직관성** — 비개발자 사용자는 sidebar 에 가는 단계 자체를 모르고 "텍스트 위에서 바로 수정" 을 기대.

## 변경

`src/editor/js/editor-select.js` 두 군데 패치:

### 1. `getSelectableTargetAt` — inline 자식 클릭 시 텍스트 편집 가능한 부모로 자동 올라감

inner `<span>` / `<strong>` / `<em>` 등 inline element 안을 클릭해도 그 부모 (`<h1>` / `<p>` / `<li>`) 가 selection target. 사용자가 부분 강조된 텍스트도 자연스럽게 선택 가능.

### 2. `setSelectedObjectXPath` — selection 시 contentEditable=true 적용

새로 선택된 element 가 텍스트 편집 가능하면:
- `contenteditable="true"` + `spellcheck="false"` 속성 추가
- 시각적 표시 (`outline: 2px dashed rgba(52, 211, 153, 0.7)`)
- 다음 tick 에 `focus()` — 즉시 caret 활성
- `blur` 이벤트 리스너 — focus 잃는 어떤 경로든 (toolbar 클릭 / iframe 밖 / 다른 앱 전환) 즉시 `scheduleDirectSave` 호출

selection 이 다음 element 로 바뀔 때 (= `setSelectedObjectXPath` 가 다시 호출됨):
- 이전 element 의 contentEditable 해제 + outline 복원
- `scheduleDirectSave` 한 번 더 (안전망)

## 효과

- 사용자가 슬라이드 안 텍스트 클릭 → 즉시 caret. **inline 으로 직접 수정**.
- inline 자식 (`<span style="color: ...">`, `<strong>`, `<em>` 등) 의 구조와 스타일이 그대로 **보존됨**. 사용자는 텍스트만 고치고 색깔 / 굵기는 그대로.
- 다른 곳 (slide 안 / toolbar / iframe 밖) 어디를 클릭해도 변경이 자동 저장됨.

## diff (요지)

```diff
+ import { scheduleDirectSave } from './editor-direct-edit.js';

  // ... getSelectableTargetAt
- let node = doc.elementFromPoint(point.x, point.y);
+ const hit = doc.elementFromPoint(point.x, point.y);
+
+ // inline 자식 안 클릭 시 텍스트 편집 가능 부모 (h1/p/li) 까지 올라감
+ let cursor = hit;
+ while (cursor) {
+   if (isTextEditableElement(cursor)) return cursor;
+   cursor = cursor.parentElement;
+ }
+ let node = hit;

  // ... setSelectedObjectXPath cleanup of previous element
+ const prevEl = getSelectedObjectElement();
+ if (prevEl && prevEl.isContentEditable) {
+   prevEl.removeAttribute('contenteditable');
+   prevEl.removeAttribute('spellcheck');
+   prevEl.style.outline = '';
+   scheduleDirectSave(0, 'Slide text edited.');
+ }

  // ... setSelectedObjectXPath setup of new element
+ const newEl = getSelectedObjectElement();
+ if (newEl && isTextEditableElement(newEl)) {
+   newEl.setAttribute('contenteditable', 'true');
+   newEl.setAttribute('spellcheck', 'false');
+   newEl.style.outline = '2px dashed rgba(52, 211, 153, 0.7)';
+   setTimeout(() => { try { newEl.focus(); } catch {} }, 0);
+   newEl.addEventListener('blur', function onBlur() {
+     scheduleDirectSave(0, 'Slide text edited.');
+   });
+ }
```

## 호환성

- 기존 sidebar `popoverTextInput` 흐름은 그대로 유지됨 (사용자가 sidebar 입력해도 동작 동일).
- 추가 동작 — slide 안 직접 클릭 → contentEditable 활성화.
- 두 흐름 다 같은 `scheduleDirectSave` 로 저장이라 충돌 없음.

## 알려진 한계 (downstream 에서 우회 중)

slides-grab 의 throttled auto-save 가 입력 도중 trigger 되면 `contenteditable="true"` / `outline: ...` inline 속성이 slide HTML 에 영구 저장되는 케이스가 있음. downstream (bitreespark) 에서는:

- slide 응답 라우트에서 strip
- 부팅 시 한 번 모든 slide HTML traverse 후 cleanup
- export 직전 같은 deck cleanup

세 겹 우회로 해결 중. upstream 에서 save 직전 cleanup hook 까지 추가하면 downstream 우회 제거 가능 — 별도 PR 로 제안 가능합니다.

## 재현 / 검증

bitreespark_II 의 patches/slides-grab@1.2.6.patch 형태로 약 한 달간 검증. 비개발자 사용자가 inline 강조 텍스트도 자연스럽게 수정 가능.
