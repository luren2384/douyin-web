"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  getSavedVideos,
  updateTranscript,
  removeVideo,
  type SavedVideo,
} from "@/lib/storage";

export default function VideoToTextPage() {
  const [videos, setVideos] = useState<SavedVideo[]>([]);
  const [transcribingIds, setTranscribingIds] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchMode, setBatchMode] = useState(false);
  const [error, setError] = useState("");
  const runningRef = useRef(false);

  const refreshList = useCallback(() => {
    setVideos(getSavedVideos());
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  async function transcribeOne(video: SavedVideo): Promise<boolean> {
    setTranscribingIds((prev) => new Set(prev).add(video.aweme_id));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 600000); // 10 分钟超时
      const resp = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: video.video_url }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await resp.json();
      if (!data.ok) {
        throw new Error(data.error ?? "转文字失败");
      }
      updateTranscript(video.aweme_id, data.text);
      refreshList();
      return true;
    } catch (err: any) {
      // 把错误也存入 transcript，方便用户看到
      updateTranscript(video.aweme_id, `[转写失败] ${err?.message ?? "未知错误"}`);
      refreshList();
      return false;
    } finally {
      setTranscribingIds((prev) => {
        const next = new Set(prev);
        next.delete(video.aweme_id);
        return next;
      });
    }
  }

  async function handleSingleTranscribe(video: SavedVideo) {
    setError("");
    const ok = await transcribeOne(video);
    if (!ok) setError(`${video.desc?.slice(0, 20) ?? "视频"} 转写失败`);
  }

  /** 批量转文字：同时最多 2 个并发 */
  async function handleBatchTranscribe() {
    const pending = videos.filter((v) => !v.transcript);
    if (pending.length === 0) {
      setError("所有视频都已转写完成");
      return;
    }

    if (runningRef.current) return;
    runningRef.current = true;
    setBatchMode(true);
    setError("");
    setBatchProgress({ done: 0, total: pending.length });

    let done = 0;
    const queue = [...pending];
    const concurrency = 2;

    async function worker() {
      while (queue.length > 0) {
        const video = queue.shift();
        if (!video) break;
        await transcribeOne(video);
        done++;
        setBatchProgress({ done, total: pending.length });
      }
    }

    // 启动 concurrency 个 worker
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    runningRef.current = false;
    setBatchMode(false);
  }

  function handleDownloadText(video: SavedVideo) {
    if (!video.transcript) return;
    const filename = `${sanitizeFilename(video.desc || video.aweme_id)}.doc`;
    // 用 HTML 格式生成 Word 文档，Word 可直接打开
    const paragraphs = video.transcript
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => `<p style="margin:0 0 12pt 0;line-height:1.8;">${escapeHtml(line)}</p>`)
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(video.desc || "转写结果")}</title></head><body style="font-family:'微软雅黑',sans-serif;font-size:12pt;">${paragraphs}</body></html>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sanitizeFilename(str: string): string {
    // 去除 Windows 文件名非法字符，截断过长标题
    return str
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\n/g, " ")
      .trim()
      .slice(0, 80) || "未命名";
  }

  function handleDelete(video: SavedVideo) {
    removeVideo(video.aweme_id);
    refreshList();
  }

  const pendingCount = videos.filter((v) => !v.transcript).length;
  const completedCount = videos.filter(
    (v) => v.transcript && !v.transcript.startsWith("[转写失败]")
  ).length;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      {/* 标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          视频转文字
        </h1>
        <p className="text-sm text-zinc-500">
          将已解析的视频语音批量转录为文字，支持下载
        </p>
      </div>

      {error && (
        <div className="w-full max-w-2xl mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 批量操作栏 */}
      {videos.length > 0 && (
        <div className="w-full max-w-2xl mb-4 flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            共 {videos.length} 个视频 · 已转写 {completedCount} · 待转写{" "}
            {pendingCount}
          </div>
          {pendingCount > 0 && (
            <button
              onClick={handleBatchTranscribe}
              disabled={batchMode}
              className="rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-white transition-colors"
            >
              {batchMode
                ? `批量转写中 (${batchProgress.done}/${batchProgress.total})`
                : `🎙️ 全部转文字 (${pendingCount})`}
            </button>
          )}
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
          videos.map((video) => {
            const isTranscribing = transcribingIds.has(video.aweme_id);
            const isFailed =
              video.transcript?.startsWith("[转写失败]") ?? false;

            return (
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
                      <div
                        className={`rounded-lg bg-zinc-950/50 border p-3 ${
                          isFailed ? "border-red-500/30" : "border-zinc-800"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-zinc-500">
                            {isFailed ? "转写失败" : "转文字结果"}
                            {video.transcribed_at && !isFailed && (
                              <span className="ml-2">
                                (
                                {new Date(video.transcribed_at).toLocaleString(
                                  "zh-CN"
                                )}
                                )
                              </span>
                            )}
                          </span>
                        </div>
                        <p
                          className={`text-sm whitespace-pre-wrap break-words max-h-48 overflow-y-auto ${
                            isFailed ? "text-red-400" : "text-zinc-300"
                          }`}
                        >
                          {video.transcript}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!isFailed && (
                          <button
                            onClick={() => handleDownloadText(video)}
                            className="flex-1 rounded-lg bg-brand hover:bg-brand-dark px-4 py-2.5 text-sm font-medium text-white transition-colors"
                          >
                            下载Word
                          </button>
                        )}
                        <button
                          onClick={() => handleSingleTranscribe(video)}
                          disabled={isTranscribing}
                          className="rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-4 py-2.5 text-sm text-zinc-300 transition-colors"
                        >
                          {isTranscribing ? "转写中..." : "重新转写"}
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
                        onClick={() => handleSingleTranscribe(video)}
                        disabled={isTranscribing}
                        className="flex-1 rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition-colors"
                      >
                        {isTranscribing
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
            );
          })
        )}
      </div>

      {/* 底部说明 */}
      <div className="w-full max-w-2xl mt-12 text-xs text-zinc-600 space-y-1">
        <p>说明：</p>
        <p>1. 先在「视频解析」页面批量解析视频，视频会自动出现在此列表</p>
        <p>2. 点击「全部转文字」批量转写，或单个点击「视频转文字」</p>
        <p>3. 转写完成后可逐个下载为 Word 文档（.doc）</p>
        <p className="text-zinc-700 mt-2">
          说明：批量转写同时处理 2 个视频，每个可能需要 1-2 分钟
        </p>
      </div>
    </main>
  );
}
