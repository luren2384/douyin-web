import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "抖音视频解析下载",
  description: "无水印抖音视频解析下载工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
