import { redirect } from "next/navigation";

// /my-templates/new 직접 URL 진입은 /my-templates 로 보냄.
// 정식 생성 흐름은 /my-templates 에서 + 버튼 → 이름 입력 → 만들기 (server roundtrip 한 번).
// 예전엔 여기서 자동 POST + redirect 했는데, 사용자가 잘못 진입만 해도 빈 양식이
// 만들어지던 문제가 있어서 흐름 통일.
export default function NewMyTemplateRedirect() {
  redirect("/my-templates");
}
