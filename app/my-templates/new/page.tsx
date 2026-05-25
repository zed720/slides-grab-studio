"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /my-templates 의 + 버튼이 직접 POST → 곧장 [id] 페이지로 이동하므로 보통 안 들어옴.
// 직접 URL 진입 시 새 양식 하나 만들고 [id] 페이지로 redirect.
export default function NewMyTemplatePage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/my-templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "새 양식" }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { template: { id: string } };
        router.replace(`/my-templates/${data.template.id}`);
      } catch {
        router.replace("/my-templates");
      }
    })();
  }, [router]);
  return (
    <div className="p-12 text-center text-[14px] text-[var(--text-muted)]">
      새 양식 준비 중…
    </div>
  );
}
