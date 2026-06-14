"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import InputForm, { type BatchResult } from "@/components/InputForm";
import ResultCard from "@/components/ResultCard";
import type { ParseResult } from "@/lib/douyin-parser";
import { saveVideos, type SavedVideo } from "@/lib/storage";

export default function Home() {
  const [results, setResults] = useState<BatchResult[]>([]);

  const handleBatchResult = useCallback((batchResults: BatchResult[]) => {
    setResults(batchResults);

    // 把解析成功的视频批量保存到 localStorage
    const videosToSave: SavedVideo[] = [];
    for (const item of batchResults) {
      if (item.result.ok && item.result.data) {
        const d = item.result.data as ParseResult;
        if (d.content_type === "video" && d.qualities?.length) {
          videosToSave.push({
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
    }
    if (videosToSave.length > 0) {
      saveVideos(videosToSave);
    }
  }, []);

  const successCount = results.filter((r) => r.result.ok).length;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      {/* 标题 */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          抖音视频解析下载
        </h1>
        <p className="text-sm text-zinc-500">
          粘贴分享链接（支持批量，最多10个），获取无水印视频
        </p>
      </div>

      {/* 输入表单 */}
      <div className="w-full flex flex-col items-center gap-6">
        <InputForm onBatchResult={handleBatchResult} />

        {/* 批量结果统计 */}
        {results.length > 0 && (
          <div className="w-full max-w-2xl flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              解析结果：{successCount} 成功 / {results.length - successCount}{" "}
              失败 / 共 {results.length} 个
            </span>
            <Link
              href="/video-to-text"
              className="text-sm text-brand hover:text-brand-dark transition-colors"
            >
              去视频转文字 →
            </Link>
          </div>
        )}

        {/* 结果列表 */}
        <div className="w-full max-w-2xl space-y-4">
          {results.map((item, idx) => (
            <div key={idx}>
              {item.result.ok && item.result.data ? (
                <ResultCard data={item.result.data as ParseResult} />
              ) : (
                <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
                  <p className="text-sm text-red-400 break-all">
                    <span className="text-zinc-500 mr-2">#{idx + 1}</span>
                    {item.url}
                  </p>
                  <p className="text-sm text-red-400 mt-1">
                    {item.result.error ?? "解析失败"}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 视频转文字入口 */}
      <div className="w-full max-w-2xl mt-8">
        <Link
          href="/video-to-text"
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-3 text-sm text-zinc-200 transition-colors"
        >
          <span className="text-lg">🎙️</span>
          视频转文字 - 批量转写已解析的视频
        </Link>
      </div>

      {/* 使用说明 */}
      <div className="w-full max-w-2xl mt-12 text-xs text-zinc-600 space-y-1">
        <p>使用说明：</p>
        <p>1. 打开抖音 APP，点击视频右下角「分享」→「复制链接」</p>
        <p>2. 粘贴到上方输入框（每行一个，最多10个），点击「批量解析」</p>
        <p>3. 解析成功后可选择清晰度下载</p>
        <p>4. 视频解析后可前往「视频转文字」批量将视频语音转为文字</p>
        <p className="text-zinc-700 mt-2">
          注意：需要配置有效的抖音 Cookie 才能正常解析（环境变量 DOUYIN_COOKIE）
        </p>
      </div>
    </main>
  );
}
