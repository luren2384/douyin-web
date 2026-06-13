"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import InputForm from "@/components/InputForm";
import ResultCard from "@/components/ResultCard";
import { ApiResult } from "@/components/types";
import type { ParseResult } from "@/lib/douyin-parser";
import { saveVideo } from "@/lib/storage";

export default function Home() {
  const [result, setResult] = useState<ApiResult | null>(null);

  const handleResult = useCallback((res: ApiResult) => {
    setResult(res);
    // 解析成功后保存视频信息到本地，供视频转文字使用
    if (res.ok && res.data) {
      const d = res.data as ParseResult;
      if (d.content_type === "video" && d.qualities?.length) {
        saveVideo({
          aweme_id: d.aweme_id,
          desc: d.desc,
          author: d.author,
          cover: d.cover,
          duration: d.duration,
          video_url: d.qualities[0].url,
          saved_at: Date.now(),
        });
      }
    }
  }, []);

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
        <InputForm onResult={handleResult} />
        {result?.ok && result.data && (
          <ResultCard data={result.data as ParseResult} />
        )}
      </div>

      {/* 视频转文字入口 */}
      <div className="w-full max-w-2xl mt-8">
        <Link
          href="/video-to-text"
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-3 text-sm text-zinc-200 transition-colors"
        >
          <span className="text-lg">🎙️</span>
          视频转文字 - 点击前往
        </Link>
      </div>

      {/* 使用说明 */}
      <div className="w-full max-w-2xl mt-12 text-xs text-zinc-600 space-y-1">
        <p>使用说明：</p>
        <p>1. 打开抖音 APP，点击视频右下角「分享」→「复制链接」</p>
        <p>2. 粘贴到上方输入框，点击「解析视频」</p>
        <p>3. 解析成功后可选择清晰度下载</p>
        <p>4. 视频解析后可前往「视频转文字」将视频语音转为文字</p>
        <p className="text-zinc-700 mt-2">
          注意：需要配置有效的抖音 Cookie 才能正常解析（环境变量 DOUYIN_COOKIE）
        </p>
      </div>
    </main>
  );
}
