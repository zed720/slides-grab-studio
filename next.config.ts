import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // server-side 패키지 (native binding 등) — bundler 가 건들지 않게.
  serverExternalPackages: ["better-sqlite3", "slides-grab"],
  // 배포 빌드 — .next/standalone/server.js 한 파일로 즉시 실행 가능.
  // .app 안에 standalone 출력만 넣으면 됨 (node_modules 전체 필요 X).
  output: "standalone",
};

export default nextConfig;
