import { NextRequest } from "next/server";
import { DEFAULT_UA } from "@/lib/douyin-parser";

export const dynamic = "force-dynamic";

/**
 * 视频下载代理接口
 * 浏览器无法直接设置 Referer 头，抖音 CDN 会返回 403
 * 此接口由服务端带上正确的请求头，流式转发视频内容给浏览器
 *
 * 用法: /api/download?url=<视频URL>&filename=<文件名>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("url");
  const filename = searchParams.get("filename") || "video.mp4";

  if (!videoUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  try {
    const resp = await fetch(videoUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Referer: "https://www.douyin.com/",
        Origin: "https://www.douyin.com",
        Accept: "*/*",
        Range: "bytes=0-",
      },
      redirect: "follow",
      // @ts-ignore - Node fetch 支持
      signal: AbortSignal.timeout(60000),
    });

    if (!resp.ok && resp.status !== 206) {
      return new Response(`Failed to fetch video: ${resp.status}`, {
        status: resp.status,
      });
    }

    // 获取内容类型和长度
    const contentType =
      resp.headers.get("content-type") || "video/mp4";
    const contentLength = resp.headers.get("content-length");

    // 转发流式响应，设置下载头
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    };
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    return new Response(resp.body, { headers });
  } catch (err: any) {
    return new Response(err?.message ?? "Download failed", { status: 500 });
  }
}
