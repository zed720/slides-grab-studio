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
  baseWidth = 960,
  baseHeight = 540,
  sandbox = "",
  lazy = false,
  blockInteraction = true,
  className,
}: Props) {
  const ratio = baseWidth / baseHeight;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

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
          title={title}
          src={src}
          srcDoc={srcDoc}
          loading={lazy ? "lazy" : undefined}
          sandbox={sandbox}
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
