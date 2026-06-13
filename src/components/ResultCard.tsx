"use client";

import { useState } from "react";
import type { ParseResult } from "@/lib/douyin-parser";

interface Props {
  data: ParseResult;
}

export default function ResultCard({ data }: Props) {
  const [selectedUrl, setSelectedUrl] = useState<string>(
    data.qualities?.[0]?.url ?? data.nwm_url ?? ""
  );
  const [copied, setCopied] = useState(false);

  const isVideo = data.content_type === "video";

  function handleDownload(url: string, filename: string) {
    // 抖音 CDN 要求 Referer 头，浏览器无法直接设置
    // 通过服务端代理接口转发，触发浏览器下载
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 忽略
    }
  }

  return (
    <div className="w-full max-w-2xl rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      {/* 封面 + 基本信息 */}
      <div className="flex gap-4 p-4">
        {data.cover && (
          <img
            src={data.cover}
            alt={data.desc || "封面"}
            className="w-32 h-44 object-cover rounded-lg flex-shrink-0 bg-zinc-800"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="flex flex-col justify-between flex-1 min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  isVideo
                    ? "bg-brand/20 text-brand"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {isVideo ? "视频" : `图集${data.image_data ? `(${data.image_data.image_count}张)` : ""}`}
              </span>
              {data.duration > 0 && (
                <span className="text-xs text-zinc-500">
                  时长 {Math.floor(data.duration / 1000)}s
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-200 line-clamp-3 break-words">
              {data.desc || "（无描述）"}
            </p>
          </div>
          <p className="text-xs text-zinc-500 mt-2">@{data.author || "未知"}</p>
        </div>
      </div>

      <div className="border-t border-zinc-800 p-4 space-y-3">
        {isVideo ? (
          <>
            {/* 视频质量选择 */}
            {data.qualities && data.qualities.length > 1 && (
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">选择清晰度</label>
                <select
                  value={selectedUrl}
                  onChange={(e) => setSelectedUrl(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:border-brand"
                >
                  {data.qualities.map((q, i) => (
                    <option key={i} value={q.url}>
                      {q.quality_label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 视频操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={() =>
                  handleDownload(
                    selectedUrl,
                    `${data.aweme_id || "video"}.mp4`
                  )
                }
                className="flex-1 rounded-lg bg-brand hover:bg-brand-dark px-4 py-2.5 text-sm font-medium text-white transition-colors"
              >
                下载视频
              </button>
              <button
                onClick={() => handleCopy(selectedUrl)}
                className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition-colors"
              >
                {copied ? "已复制" : "复制链接"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 图集下载 */}
            {(() => {
              const imgData = data.image_data;
              if (!imgData) return null;
              return (
              <>
                {/* 图片预览网格 */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {imgData.image_urls.slice(0, 8).map((imgUrl, i) => {
                    const proxyPreview = `/api/download?url=${encodeURIComponent(imgUrl)}`;
                    return (
                    <div
                      key={i}
                      className="relative aspect-[3/4] rounded overflow-hidden bg-zinc-800"
                    >
                      <img
                        src={proxyPreview}
                        alt={`图 ${i + 1}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => window.open(proxyPreview, "_blank")}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "0.3";
                        }}
                      />
                      <span className="absolute bottom-0 right-0 bg-black/60 text-white text-xs px-1 rounded-tl">
                        {i + 1}
                      </span>
                    </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {imgData.image_urls.map((imgUrl, i) => {
                    const ext = imgData.is_live ? "mp4" : "jpg";
                    const fname = `${String(i + 1).padStart(3, "0")}.${ext}`;
                    const proxyUrl = `/api/download?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(fname)}`;
                    return (
                    <a
                      key={i}
                      href={proxyUrl}
                      download={fname}
                      className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors"
                    >
                      {imgData.is_live ? `视频 ${i + 1}` : `图片 ${i + 1}`}
                    </a>
                    );
                  })}
                </div>
              </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
