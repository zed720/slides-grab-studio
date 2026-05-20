import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bitree slide studio",
  description: "터미널 없이 AI로 슬라이드 만들기",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
