"use client";

import { useState } from "react";
import { ApiResult } from "./types";

export interface BatchResult {
  url: string;
  result: ApiResult;
}

interface Props {
  onBatchResult: (results: BatchResult[]) => void;
}

const MAX_BATCH = 10;

export default function InputForm({ onBatchResult }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 按行分割，去重，过滤空行
    const urls = [
      ...new Set(
        text
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      ),
    ];

    if (urls.length === 0) {
      setError("请输入至少一个抖音分享链接");
      return;
    }

    if (urls.length > MAX_BATCH) {
      setError(`最多支持 ${MAX_BATCH} 个链接，当前 ${urls.length} 个`);
      return;
    }

    setLoading(true);
    setError("");
    setProgress({ done: 0, total: urls.length });

    const results: BatchResult[] = [];

    // 逐个解析
    for (let i = 0; i < urls.length; i++) {
      try {
        const resp = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urls[i] }),
        });
        const data: ApiResult = await resp.json();
        results.push({ url: urls[i], result: data });
      } catch (err: any) {
        results.push({
          url: urls[i],
          result: { ok: false, error: err?.message ?? "网络请求失败" },
        });
      }
      setProgress({ done: i + 1, total: urls.length });
    }

    onBatchResult(results);
    setLoading(false);
  }

  async function handlePaste() {
    try {
      const clipText = await navigator.clipboard.readText();
      setText((prev) => {
        if (!prev.trim()) return clipText;
        return prev + "\n" + clipText;
      });
    } catch {
      // 剪贴板权限被拒绝
    }
  }

  function handleClear() {
    setText("");
    setError("");
  }

  const lineCount = text.split("\n").filter((s) => s.trim().length > 0).length;

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              "粘贴抖音分享链接，每行一个，最多 10 个\n例如：\nhttps://v.douyin.com/xxx\nhttps://v.douyin.com/yyy"
            }
            rows={6}
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm placeholder-zinc-500 focus:outline-none focus:border-brand transition-colors resize-y"
            disabled={loading}
          />
          {lineCount > 0 && (
            <span
              className={`absolute bottom-2 right-3 text-xs ${
                lineCount > MAX_BATCH ? "text-red-400" : "text-zinc-500"
              }`}
            >
              {lineCount}/{MAX_BATCH}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePaste}
            className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-3 text-sm text-zinc-300 transition-colors whitespace-nowrap"
            disabled={loading}
          >
            粘贴
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-3 text-sm text-zinc-300 transition-colors whitespace-nowrap"
            disabled={loading}
          >
            清空
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-medium text-white transition-colors"
          >
            {loading
              ? `解析中... (${progress.done}/${progress.total})`
              : `批量解析（最多 ${MAX_BATCH} 个）`}
          </button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
