"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Props = {
  /** iframe src URL. srcDoc 와 둘 중 하나 필수. */
  src?: string;
  /** inline HTML 문자열로 iframe 채움 (template preview 등). */
  srcDoc?: string;
  title: string;
  /** 슬라이드 원본 viewport 폭 (px). 기본 960 (slides-grab 표준). */
  baseWidth?: number;
  /** 슬라이드 원본 viewport 높이 (px). 기본 540. */
  baseHeight?: number;
  /**
   * iframe load 후 body 의 실제 fixed size 를 자동 detect 해서 baseWidth/Height
   * 대신 사용. 같은 페이지 안 deck 마다 slide 의 viewport 가 다를 때 (예:
   * slides-grab 자체 style = 720×405, BITREE custom = 960×540, 등) 각 슬라이드에
   * 맞게 자동 스케일. cross-origin iframe 에선 동작 X (same-origin 필요).
   */
  autoDetect?: boolean;
  /** iframe sandbox 속성. 기본 빈 문자열 (모든 권한 제거). */
  sandbox?: string;
  /** lazy 로드 — 썸네일/카드 그리드에서 권장. */
  lazy?: boolean;
  /** iframe 위의 클릭/스크롤이 iframe 으로 가지 않게. 기본 true. */
  blockInteraction?: boolean;
  /** wrap 의 추가 클래스 (rounded, shadow 등 디자인). */
  className?: string;
};

// PPT 표준 미리보기 패턴.
// 슬라이드는 1280x720 fixed viewport. iframe 자체를 그 사이즈로 두고
// 부모 사이즈에 맞춰 transform: scale 로 축소.
// 컴포넌트가 *부모의 사이즈를 측정* 해서 자기 wrap 을 16:9 박스로 명시.
// (호출자가 `aspect-video` + inline width/height 100% 같은 조합으로 fit 시키려고
// 시도하면 Chrome 의 aspect-ratio + max-height 처리에서 16:9 가 깨지는 케이스
// 가 있어서, sizing 책임을 컴포넌트 내부로 옮김.)
export function ScaledSlideFrame({
  src,
  srcDoc,
  title,
  baseWidth: baseWidthProp = 960,
  baseHeight: baseHeightProp = 540,
  autoDetect = false,
  sandbox = "",
  lazy = false,
  blockInteraction = true,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // autoDetect 면 iframe load 후 측정한 body size. 측정 전엔 prop (기본) 사용.
  const [detected, setDetected] = useState<{ w: number; h: number } | null>(
    null,
  );

  const baseWidth = autoDetect && detected ? detected.w : baseWidthProp;
  const baseHeight = autoDetect && detected ? detected.h : baseHeightProp;
  const ratio = baseWidth / baseHeight;

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const parent = wrap.parentElement;
    if (!parent) return;

    const measure = () => {
      const pw = parent.clientWidth;
      const ph = parent.clientHeight;
      if (pw === 0 || ph === 0) return;
      let w = pw;
      let h = w / ratio;
      if (h > ph) {
        h = ph;
        w = h * ratio;
      }
      setBox((prev) =>
        Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5
          ? prev
          : { w, h },
      );
    };

    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    measure();
    return () => ro.disconnect();
  }, [ratio]);

  // autoDetect — iframe load 후 body 의 computed size 측정.
  // body style 에 fixed 박혀있어도 (예: slides-grab 의 720×405) computed style
  // 로 정확한 값 받음. 측정 실패 (cross-origin / body 없음) 시 prop default 유지.
  const onLoad = () => {
    if (!autoDetect) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const cs = doc.defaultView?.getComputedStyle(doc.body);
      if (!cs) return;
      const w = parseFloat(cs.width);
      const h = parseFloat(cs.height);
      if (w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h)) {
        setDetected((prev) =>
          prev && Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5
            ? prev
            : { w, h },
        );
      }
    } catch {
      // cross-origin 등 — silent. prop default 그대로.
    }
  };

  const scale = box.w / baseWidth;

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={
        box.w > 0
          ? { width: `${box.w}px`, height: `${box.h}px` }
          : { width: 0, height: 0 }
      }
    >
      {scale > 0 ? (
        <iframe
          ref={iframeRef}
          title={title}
          src={src}
          srcDoc={srcDoc}
          loading={lazy ? "lazy" : undefined}
          sandbox={sandbox}
          onLoad={onLoad}
          className={`absolute left-0 top-0 border-0 ${
            blockInteraction ? "pointer-events-none" : ""
          }`}
          style={{
            width: `${baseWidth}px`,
            height: `${baseHeight}px`,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
          }}
        />
      ) : null}
    </div>
  );
}
