"use client";

import { useState } from "react";
import InputForm from "@/components/InputForm";
import ResultCard from "@/components/ResultCard";
import { ApiResult } from "@/components/types";
import type { ParseResult } from "@/lib/douyin-parser";

export default function Home() {
  const [result, setResult] = useState<ApiResult | null>(null);

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      {/* 标题 */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          抖音视频解析下载
        </h1>
        <p className="text-sm text-zinc-500">
          粘贴分享链接，获取无水印视频/图集
        </p>
      </div>

      {/* 输入表单 + 结果 */}
      <div className="w-full flex flex-col items-center gap-6">
        <InputForm onResult={setResult} />
        {result?.ok && result.data && (
          <ResultCard data={result.data as ParseResult} />
        )}
      </div>

      {/* 使用说明 */}
      <div className="w-full max-w-2xl mt-12 text-xs text-zinc-600 space-y-1">
        <p>使用说明：</p>
        <p>1. 打开抖音 APP，点击视频右下角「分享」→「复制链接」</p>
        <p>2. 粘贴到上方输入框，点击「解析视频」</p>
        <p>3. 解析成功后可选择清晰度下载</p>
        <p className="text-zinc-700 mt-2">
          注意：需要配置有效的抖音 Cookie 才能正常解析（环境变量 DOUYIN_COOKIE）
        </p>
      </div>
    </main>
  );
}
