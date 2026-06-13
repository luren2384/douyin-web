"use client";

import { useState } from "react";
import { ApiResult } from "./types";

interface Props {
  onResult: (result: ApiResult) => void;
}

export default function InputForm({ onResult }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("请输入抖音分享链接");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data: ApiResult = await resp.json();

      if (!data.ok) {
        setError(data.error ?? "解析失败");
      }
      onResult(data);
    } catch (err: any) {
      setError(err?.message ?? "网络请求失败");
      onResult({ ok: false, error: err?.message });
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      // 剪贴板权限被拒绝，忽略
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴抖音分享链接，如 https://v.douyin.com/xxx"
            className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm placeholder-zinc-500 focus:outline-none focus:border-brand transition-colors"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handlePaste}
            className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-3 text-sm text-zinc-300 transition-colors whitespace-nowrap"
            disabled={loading}
          >
            粘贴
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-medium text-white transition-colors"
        >
          {loading ? "解析中..." : "解析视频"}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
