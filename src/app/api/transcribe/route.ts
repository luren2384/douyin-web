import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { DEFAULT_UA } from "@/lib/douyin-parser";

// 系统安装的 ffmpeg 绝对路径（winget 安装位置）
const FFMPEG_PATH = "C:\\Users\\yuhan\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 视频转文字接口
 *
 * 流程：
 * 1. 服务端下载抖音视频（带 Referer 绕过 403）
 * 2. 用 ffmpeg 提取音频为 mp3（大幅减小体积，确保在扣子 10MB 限制内）
 * 3. 上传 mp3 到扣子 ASR（/v1/audio/transcriptions）转文字
 *
 * 请求体: { video_url: string }
 * 返回: { ok: boolean, text?: string, error?: string }
 */
export async function POST(request: NextRequest) {
  const tmpDir = join(tmpdir(), "douyin-transcribe");
  let tmpVideoPath = "";
  let tmpAudioPath = "";

  try {
    const body = await request.json();
    const videoUrl: string = body?.video_url ?? "";

    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json(
        { ok: false, error: "缺少 video_url 参数" },
        { status: 400 }
      );
    }

    const cozeToken = process.env.COZE_WORKLOAD_API_TOKEN;
    if (!cozeToken) {
      return NextResponse.json(
        { ok: false, error: "未配置 COZE_WORKLOAD_API_TOKEN" },
        { status: 500 }
      );
    }

    await mkdir(tmpDir, { recursive: true });
    const jobId = randomUUID();
    tmpVideoPath = join(tmpDir, `${jobId}.mp4`);
    tmpAudioPath = join(tmpDir, `${jobId}.mp3`);

    // 第一步：下载视频（带 Referer 绕过抖音 CDN 403）
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
    await writeFile(tmpVideoPath, videoBuffer);

    // 第二步：ffmpeg 提取音频为 mp3（64kbps/16kHz/单声道，语音识别足够）
    await extractAudio(tmpVideoPath, tmpAudioPath);
    const audioBuffer = await readFile(tmpAudioPath);
    console.log(`[transcribe] 音频大小: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 第三步：上传音频到扣子 ASR
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });
    formData.append("file", audioBlob, "audio.mp3");

    const asrResp = await fetch("https://api.coze.cn/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cozeToken}`,
      },
      body: formData,
      signal: AbortSignal.timeout(120000),
    });

    if (!asrResp.ok) {
      const errText = await asrResp.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: `扣子 ASR 请求失败(${asrResp.status}): ${errText.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    const asrData = await asrResp.json();

    if (asrData.code !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `语音识别失败: ${asrData.msg ?? "未知错误"}`,
        },
        { status: 502 }
      );
    }

    const text = asrData.data?.text ?? "";
    console.log(`[transcribe] 转写完成, 文字长度: ${text.length}`);
    return NextResponse.json({ ok: true, text });
  } catch (err: any) {
    console.error("[transcribe] 错误:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "服务器内部错误" },
      { status: 500 }
    );
  } finally {
    // 清理临时文件
    for (const p of [tmpVideoPath, tmpAudioPath]) {
      if (p) await unlink(p).catch(() => {});
    }
  }
}

/**
 * 用 ffmpeg 从视频中提取音频为 mp3
 */
function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("[ffmpeg] 使用路径:", FFMPEG_PATH);

    const proc = spawn(FFMPEG_PATH, [
      "-i", videoPath,
      "-vn",
      "-acodec", "libmp3lame",
      "-ab", "64k",
      "-ar", "16000",
      "-ac", "1",
      "-y",
      audioPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg 提取音频失败(exit ${code}): ${stderr.slice(-500)}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`ffmpeg 启动失败: ${err.message}`));
    });
  });
}
