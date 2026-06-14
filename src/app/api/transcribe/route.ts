import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { DEFAULT_UA } from "@/lib/douyin-parser";

// 火山引擎 LAS API
const LAS_BASE = "https://operator.las.cn-beijing.volces.com/api/v1";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 视频转文字接口（火山引擎 LAS + Cloudflare R2 方案）
 *
 * 流程：
 * 1. 服务端下载视频（带 Referer 绕过抖音 CDN 403）
 * 2. 上传视频到 Cloudflare R2（公开可访问）
 * 3. 把 R2 公开 URL 传给火山引擎 LAS（las_asr_pro）转写
 * 4. 轮询任务结果
 * 5. 清理 R2 临时文件
 * 6. 对结果文字智能分段
 *
 * 请求体: { video_url: string }
 * 返回: { ok: boolean, text?: string, error?: string }
 */
export async function POST(request: NextRequest) {
  const r2Key = `tmp/${randomUUID()}.mp4`;

  try {
    const body = await request.json();
    const videoUrl: string = body?.video_url ?? "";

    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json(
        { ok: false, error: "缺少 video_url 参数" },
        { status: 400 }
      );
    }

    const lasKey = process.env.LAS_DEFAULT_API_KEY;
    if (!lasKey) {
      return NextResponse.json(
        { ok: false, error: "未配置 LAS_DEFAULT_API_KEY" },
        { status: 500 }
      );
    }

    // 第一步：下载视频（带 Referer 绕过抖音 CDN 403）
    console.log("[transcribe] 正在下载视频...");
    const videoResp = await fetch(videoUrl, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Referer: "https://www.douyin.com/",
        Origin: "https://www.douyin.com",
        Accept: "*/*",
        Range: "bytes=0-",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(120000),
    });

    if (!videoResp.ok && videoResp.status !== 206) {
      return NextResponse.json(
        { ok: false, error: `视频下载失败: ${videoResp.status}` },
        { status: 502 }
      );
    }

    const videoBuffer = Buffer.from(await videoResp.arrayBuffer());
    console.log(`[transcribe] 视频下载完成: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 第二步：上传到 R2
    console.log("[transcribe] 正在上传到 R2...");
    const publicUrl = await uploadToR2(videoBuffer, r2Key);
    console.log(`[transcribe] R2 上传完成: ${publicUrl}`);

    // 第三步：提交 LAS ASR 任务
    const taskId = await submitAsrTask(lasKey, publicUrl);
    console.log(`[transcribe] LAS 任务已提交: ${taskId}`);

    // 第四步：轮询任务结果
    const rawText = await pollAsrResult(lasKey, taskId);
    console.log(`[transcribe] ASR 转写完成, 文字长度: ${rawText.length}`);

    // 第五步：智能分段
    const text = formatParagraphs(rawText);
    console.log("[transcribe] 智能分段完成");

    return NextResponse.json({ ok: true, text });
  } catch (err: any) {
    console.error("[transcribe] 错误:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "服务器内部错误" },
      { status: 500 }
    );
  } finally {
    // 清理 R2 临时文件
    await deleteFromR2(r2Key).catch(() => {});
  }
}

/**
 * 上传文件到 Cloudflare R2，返回公开访问 URL
 */
async function uploadToR2(buffer: Buffer, key: string): Promise<string> {
  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: "video/mp4",
    })
  );

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/**
 * 从 R2 删除临时文件
 */
async function deleteFromR2(key: string): Promise<void> {
  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
  console.log(`[transcribe] R2 临时文件已清理: ${key}`);
}

/**
 * 提交 LAS ASR 任务（las_asr_pro 增强版）
 */
async function submitAsrTask(apiKey: string, videoUrl: string): Promise<string> {
  const resp = await fetch(`${LAS_BASE}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      operator_id: "las_asr_pro",
      operator_version: "v1",
      data: {
        resource: "bigasr",
        audio: {
          url: videoUrl,
          format: "wav",
        },
        request: {
          model_name: "bigmodel",
          enable_itn: true,
          enable_punc: true,
        },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(`LAS 提交失败(${resp.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }

  if (data.metadata?.task_status !== "ACCEPTED" && data.metadata?.task_status !== "PENDING") {
    throw new Error(
      `LAS 任务未被接受: ${data.metadata?.error_msg ?? JSON.stringify(data).slice(0, 200)}`
    );
  }

  return data.metadata.task_id;
}

/**
 * 轮询 LAS ASR 任务结果
 */
async function pollAsrResult(apiKey: string, taskId: string): Promise<string> {
  const maxAttempts = 90;
  const interval = 2000; // 每 2 秒轮询一次

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(interval);

    const resp = await fetch(`${LAS_BASE}/poll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        operator_id: "las_asr_pro",
        operator_version: "v1",
        task_id: taskId,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(`LAS 轮询失败(${resp.status}): ${JSON.stringify(data).slice(0, 300)}`);
    }

    const status = data.metadata?.task_status;
    console.log(`[transcribe] 轮询 ${i + 1}/${maxAttempts}: ${status}`);

    if (status === "COMPLETED") {
      const result = data.data?.result;
      if (typeof result === "string") {
        return result;
      }
      if (result?.text) {
        return result.text;
      }
      if (Array.isArray(result)) {
        return result.map((item: any) => item.text ?? "").join("");
      }
      return JSON.stringify(result ?? "");
    }

    if (status === "FAILED") {
      throw new Error(`LAS 任务失败: ${data.metadata?.error_msg ?? "未知错误"}`);
    }
  }

  throw new Error("LAS 任务超时（5 分钟内未完成）");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 智能分段（类似讯飞听见的段落效果）
 */
function formatParagraphs(rawText: string): string {
  const cleanText = rawText.replace(/\s+/g, " ").trim();
  if (!cleanText) return "";

  const sentences =
    cleanText.match(/[^。？！\.\?!]+[。？！\.\?!]*/g) || [cleanText];

  const paragraphs: string[] = [];
  let currentPara = "";

  const breakKeywords = /^第[一二三四五六七八九十百0-9]+[名条步个章节]/;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (!currentPara) {
      currentPara = trimmed;
      continue;
    }

    if (breakKeywords.test(trimmed)) {
      paragraphs.push(currentPara);
      currentPara = trimmed;
      continue;
    }

    currentPara += trimmed;

    if (currentPara.length >= 80) {
      paragraphs.push(currentPara);
      currentPara = "";
    }
  }

  if (currentPara) {
    paragraphs.push(currentPara);
  }

  return paragraphs.join("\n\n");
}
