"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getSavedVideos,
  updateTranscript,
  removeVideo,
  type SavedVideo,
} from "@/lib/storage";

export default function VideoToTextPage() {
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refreshList = useCallback(() => {
    setVideos(getSavedVideos());
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  async function handleTranscribe(video: SavedVideo) {
    setTranscribingId(video.aweme_id);
    setError("");

    try {
      const resp = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: video.video_url }),
      });
      const data = await resp.json();

      if (!data.ok) {
        setError(data.error ?? "转文字失败");
        return;
      }

      updateTranscript(video.aweme_id, data.text);
      refreshList();
    } catch (err: any) {
      setError(err?.message ?? "网络请求失败");
    } finally {
      setTranscribingId(null);
    }
  }

  function handleDownloadText(video: SavedVideo) {
    if (!video.transcript) return;
    const filename = `${video.author || "video"}-${video.aweme_id}.txt`;
    const blob = new Blob([video.transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleDelete(video: SavedVideo) {
    removeVideo(video.aweme_id);
    refreshList();
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      {/* 标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          视频转文字
        </h1>
        <p className="text-sm text-zinc-500">
          将已解析的视频语音转录为文字，支持下载
        </p>
      </div>

      {error && (
        <div className="w-full max-w-2xl mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 视频列表 */}
      <div className="w-full max-w-2xl space-y-4">
        {videos.length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
            <p className="text-sm mb-4">还没有解析过的视频</p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-brand hover:bg-brand-dark px-6 py-2.5 text-sm font-medium text-white transition-colors"
            >
              去解析视频
            </Link>
          </div>
        ) : (
          videos.map((video) => (
            <div
              key={video.aweme_id}
              className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden"
            >
              {/* 视频信息 */}
              <div className="flex gap-4 p-4">
                {video.cover && (
                  <img
                    src={`/api/download?url=${encodeURIComponent(video.cover)}`}
                    alt={video.desc || "封面"}
                    className="w-24 h-32 object-cover rounded-lg flex-shrink-0 bg-zinc-800"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div className="flex flex-col justify-between flex-1 min-w-0">
                  <div>
                    <p className="text-sm text-zinc-200 line-clamp-3 break-words">
                      {video.desc || "（无描述）"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-2">
                      @{video.author || "未知"}
                    </p>
                    {video.duration > 0 && (
                      <p className="text-xs text-zinc-600 mt-1">
                        时长 {Math.floor(video.duration / 1000)}s
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 操作区 */}
              <div className="border-t border-zinc-800 p-4 space-y-3">
                {video.transcript ? (
                  <>
                    {/* 转文字结果 */}
                    <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-500">
                          转文字结果
                          {video.transcribed_at && (
                            <span className="ml-2">
                              ({new Date(video.transcribed_at).toLocaleString("zh-CN")})
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                        {video.transcript}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownloadText(video)}
                        className="flex-1 rounded-lg bg-brand hover:bg-brand-dark px-4 py-2.5 text-sm font-medium text-white transition-colors"
                      >
                        下载文字
                      </button>
                      <button
                        onClick={() => handleTranscribe(video)}
                        disabled={transcribingId === video.aweme_id}
                        className="rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-4 py-2.5 text-sm text-zinc-300 transition-colors"
                      >
                        {transcribingId === video.aweme_id ? "转写中..." : "重新转写"}
                      </button>
                      <button
                        onClick={() => handleDelete(video)}
                        className="rounded-lg bg-zinc-800 hover:bg-red-900/50 px-4 py-2.5 text-sm text-zinc-400 hover:text-red-400 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTranscribe(video)}
                      disabled={transcribingId === video.aweme_id}
                      className="flex-1 rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition-colors"
                    >
                      {transcribingId === video.aweme_id
                        ? "正在转写，可能需要 1-2 分钟..."
                        : "🎙️ 视频转文字"}
                    </button>
                    <button
                      onClick={() => handleDelete(video)}
                      className="rounded-lg bg-zinc-800 hover:bg-red-900/50 px-4 py-2.5 text-sm text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部说明 */}
      <div className="w-full max-w-2xl mt-12 text-xs text-zinc-600 space-y-1">
        <p>说明：</p>
        <p>1. 先在「视频解析」页面解析视频，视频会自动出现在此列表</p>
        <p>2. 点击「视频转文字」，自动提取音频并转录为文字</p>
        <p>3. 转写完成后可下载文字内容为 .txt 文件</p>
        <p className="text-zinc-700 mt-2">
          说明：服务端会下载视频、提取音频后调用语音识别，可能需要 1-2 分钟
        </p>
      </div>
    </main>
  );
}
