/**
 * 抖音视频解析器 - TypeScript 移植版
 * 源自 Python 项目 douyin_video_parser.py
 */

import { getABogus } from "./abogus";
import { getXBogus } from "./xbogus";

export const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/90.0.4430.212 Safari/537.36";

export interface VideoQuality {
  url: string;
  ratio: string;
  bit_rate: number;
  quality_label: string;
}

export interface ImageData {
  image_urls: string[];
  image_urls_watermark: string[];
  image_count: number;
  preview_url: string | null;
  is_live: boolean;
}

export interface VideoMeta {
  desc: string;
  author: string;
  author_sec_uid: string;
  cover: string;
  duration: number;
  content_type: "video" | "image";
  aweme_id: string;
}

export interface ParseResult extends VideoMeta {
  nwm_url?: string | null;
  qualities?: VideoQuality[];
  image_data?: ImageData;
}

function getCookie(): string {
  return process.env.DOUYIN_COOKIE?.replace(/^\uFEFF/, "").trim() ?? "";
}

/**
 * 从分享链接提取视频 ID
 */
export async function getVideoId(shareUrl: string): Promise<string | null> {
  const urlPatterns = [
    /https?:\/\/[^\s]+/,
    /v\.douyin\.com\/[^\s]+/,
    /douyin\.com\/video\/\d+/,
    /douyin\.com\/aweme\/detail\/\d+/,
  ];

  let extractedUrl: string | null = null;
  for (const pattern of urlPatterns) {
    const match = shareUrl.match(pattern);
    if (match) {
      extractedUrl = match[0];
      if (!extractedUrl.startsWith("http")) {
        extractedUrl = "https://" + extractedUrl;
      }
      break;
    }
  }
  if (!extractedUrl) {
    extractedUrl = shareUrl.trim();
  }

  // 方法1: 直接从 URL 提取 ID
  const idPatterns = [
    /\/video\/(\d+)/,
    /\/aweme\/detail\/(\d+)/,
    /\/note\/(\d+)/,
    /video_id=(\d+)/,
    /aweme_id=(\d+)/,
    /note_id=(\d+)/,
  ];
  for (const pattern of idPatterns) {
    const match = extractedUrl.match(pattern);
    if (match) return match[1];
  }

  // 方法2: 请求获取重定向后的 URL
  try {
    const resp = await fetch(extractedUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": DEFAULT_UA,
        Referer: "https://www.douyin.com/",
      },
      signal: AbortSignal.timeout(15000),
    });

    const realUrl = resp.url;
    for (const pattern of idPatterns) {
      const match = realUrl.match(pattern);
      if (match) return match[1];
    }

    // 方法3: 从 HTML 内容提取
    const html = await resp.text();
    const htmlIdPatterns = [
      /"aweme_id":"(\d+)"/,
      /"itemId":"(\d+)"/,
      /"video_id":"(\d+)"/,
      /"note_id":"(\d+)"/,
      /\/video\/(\d+)/,
      /\/aweme\/detail\/(\d+)/,
      /\/note\/(\d+)/,
      /aweme_id=(\d+)/,
      /video_id=(\d+)/,
      /note_id=(\d+)/,
    ];
    for (const pattern of htmlIdPatterns) {
      const match = html.match(pattern);
      if (match) {
        const videoId = match[1];
        if (/^\d+$/.test(videoId) && videoId.length >= 15) {
          return videoId;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 构建 API 请求参数
 */
function buildDetailParams(videoId: string): Record<string, string> {
  return {
    device_platform: "webapp",
    aid: "6383",
    channel: "channel_pc_web",
    aweme_id: videoId,
    pc_client_type: "1",
    version_code: "290100",
    version_name: "29.1.0",
    cookie_enabled: "true",
    browser_language: "zh-CN",
    browser_platform: "Win32",
    browser_name: "Chrome",
    browser_version: "130.0.0.0",
    browser_online: "true",
    engine_name: "Blink",
    engine_version: "130.0.0.0",
    os_name: "Windows",
    os_version: "10",
    platform: "PC",
    msToken: "",
  };
}

/**
 * 请求 aweme detail API
 */
export async function getAwemeDetail(
  videoId: string,
  originalUrl?: string
): Promise<any | null> {
  const params = buildDetailParams(videoId);

  // 生成 a_bogus 签名
  try {
    const aBogus = getABogus(params);
    params["a_bogus"] = encodeURIComponent(aBogus);
  } catch {
    return null;
  }

  const isNote = originalUrl?.includes("/note/") ?? false;
  const cookie = getCookie();

  // 尝试 video referer
  let referer = `https://www.douyin.com/video/${videoId}`;
  if (isNote) {
    referer = `https://www.douyin.com/note/${videoId}`;
  }

  let result = await requestDetail(params, referer, cookie);
  if (!result && !isNote) {
    // 回退到 note referer
    result = await requestDetail(
      params,
      `https://www.douyin.com/note/${videoId}`,
      cookie
    );
  }
  return result;
}

async function requestDetail(
  params: Record<string, string>,
  referer: string,
  cookie: string
): Promise<any | null> {
  const apiUrl = "https://www.douyin.com/aweme/v1/web/aweme/detail/";
  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_UA,
    Referer: referer,
    Accept: "application/json, text/plain, */*",
  };
  if (cookie) headers["Cookie"] = cookie;

  // 方法1: 使用 a_bogus
  try {
    const searchParams = new URLSearchParams(params);
    const resp = await fetch(`${apiUrl}?${searchParams.toString()}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const text = await resp.text();
      if (text) {
        try {
          return JSON.parse(text);
        } catch {
          // 不是 JSON，继续
        }
      }
    }
  } catch {
    // 继续 X-Bogus
  }

  // 方法2: 使用 X-Bogus
  const paramStr = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  try {
    const [, xbValue] = getXBogus(paramStr, DEFAULT_UA);
    const xbUrl = `${apiUrl}?${paramStr}&X-Bogus=${xbValue}`;
    const resp = await fetch(xbUrl, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const text = await resp.text();
      if (text) {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * 判断内容类型
 */
function getContentType(data: any): "video" | "image" {
  const aweme = data?.aweme_detail ?? {};
  const awemeType = aweme.aweme_type ?? 0;
  if (awemeType === 0 || awemeType === 4) return "video";
  if (awemeType === 2 || awemeType === 68) return "image";
  if (aweme.images) return "image";
  return "video";
}

/**
 * 提取视频元信息
 */
export function extractVideoMeta(data: any): VideoMeta {
  const aweme = data?.aweme_detail ?? {};
  const author = aweme.author ?? {};
  const video = aweme.video ?? {};
  const cover =
    video.cover?.url_list?.[0] ??
    video.origin_cover?.url_list?.[0] ??
    aweme.image?.[0]?.url_list?.[0] ??
    "";

  return {
    desc: aweme.desc ?? "",
    author: author.nickname ?? "",
    author_sec_uid: author.sec_uid ?? "",
    cover,
    duration: video.duration ?? 0,
    content_type: getContentType(data),
    aweme_id: aweme.aweme_id ?? "",
  };
}

/**
 * 提取视频质量选项（无水印）
 */
export function extractVideoQualities(data: any): VideoQuality[] {
  const aweme = data?.aweme_detail ?? {};
  const video = aweme.video ?? {};
  const playAddr = video.play_addr ?? {};
  const bitRateList = video.bit_rate ?? [];
  const qualities: VideoQuality[] = [];

  // 方法1: 从 bit_rate 列表提取
  for (const brInfo of bitRateList) {
    if (typeof brInfo !== "object" || brInfo === null) continue;

    const playAddrBr = brInfo.play_addr ?? {};
    const urlListBr = playAddrBr.url_list ?? [];
    const bitRate = brInfo.bit_rate ?? 0;
    const gearName = brInfo.gear_name ?? "";

    // 解析分辨率
    let ratio = "";
    const qualityType = brInfo.quality_type;
    if (typeof qualityType === "object" && qualityType !== null) {
      ratio = qualityType.name ?? "";
    } else if (qualityType !== undefined) {
      const m = String(qualityType).match(/(\d+p)/i);
      if (m) ratio = m[1];
    }
    if (!ratio && gearName) {
      const m = gearName.toLowerCase().match(/(\d+p)/);
      if (m) ratio = m[1];
    }
    if (!ratio) {
      if (bitRate >= 2000000) ratio = "1080p";
      else if (bitRate >= 1000000) ratio = "720p";
      else if (bitRate >= 500000) ratio = "540p";
      else ratio = "480p";
    }

    for (const url of urlListBr) {
      const nwmUrl = url.replace("playwm", "play");
      const qualityLabel = bitRate
        ? `${ratio} (${Math.floor(bitRate / 1000)}Kbps)`
        : ratio;
      qualities.push({
        url: nwmUrl,
        ratio,
        bit_rate: bitRate,
        quality_label: qualityLabel,
      });
    }
  }

  // 方法2: 回退到 play_addr
  if (qualities.length === 0) {
    const urlList = playAddr.url_list ?? [];
    for (const url of urlList) {
      const nwmUrl = url.replace("playwm", "play");
      qualities.push({
        url: nwmUrl,
        ratio: "default",
        bit_rate: 0,
        quality_label: "default",
      });
    }
  }

  // 去重
  const seen = new Set<string>();
  return qualities.filter((q) => {
    if (seen.has(q.url)) return false;
    seen.add(q.url);
    return true;
  });
}

/**
 * 提取无水印地址（最高质量）
 */
export function extractNwmUrl(data: any): string | null {
  const qualities = extractVideoQualities(data);
  return qualities.length > 0 ? qualities[0].url : null;
}

/**
 * 提取图集数据
 */
export function extractImageData(data: any): ImageData | null {
  const aweme = data?.aweme_detail ?? {};
  const images = aweme.images ?? [];

  if (!images.length) return null;

  const liveUrls = new Set<string>();
  const staticUrls = new Set<string>();
  const watermarkUrls = new Set<string>();

  for (const img of images) {
    if (typeof img !== "object" || img === null) continue;

    const livePhotoType = img.live_photo_type ?? 0;
    const clipType = img.clip_type ?? 0;
    const hasVideo = !!img.video;
    const isAnimatedFlag =
      livePhotoType === 1 ||
      clipType === 5 ||
      hasVideo ||
      img.is_animated === true ||
      img.is_animated === 1 ||
      img.format === "gif";

    // 动图优先提取视频地址
    if (hasVideo && isAnimatedFlag) {
      const videoObj = img.video ?? {};
      const playAddr = videoObj.play_addr ?? {};
      const playUrlList = playAddr.url_list ?? [];
      if (playUrlList.length > 0) {
        const url = playUrlList[0];
        if (typeof url === "string") {
          const cleanUrl = url.split("&watermark=")[0].split("&logo_name=")[0];
          liveUrls.add(cleanUrl);
          continue;
        }
      }
    }

    // 静态图片 url_list
    if (!(hasVideo && isAnimatedFlag)) {
      const urlList = img.url_list ?? [];
      if (urlList.length > 0) {
        const url = urlList[0];
        if (typeof url === "string") {
          if (isAnimatedFlag) {
            liveUrls.add(url);
          } else {
            staticUrls.add(url);
          }
        }
      }

      // download_url_list（可能有水印）
      const downloadList = img.download_url_list ?? [];
      if (downloadList.length > 0) {
        const url = downloadList[0];
        if (typeof url === "string") {
          watermarkUrls.add(url);
        }
      }
    }
  }

  let finalUrls: string[];
  let isLive: boolean;
  if (liveUrls.size > 0) {
    finalUrls = Array.from(liveUrls);
    isLive = true;
  } else if (staticUrls.size > 0) {
    finalUrls = Array.from(staticUrls);
    isLive = false;
  } else if (watermarkUrls.size > 0) {
    finalUrls = Array.from(watermarkUrls);
    isLive = false;
  } else {
    return null;
  }

  // 去重（去除 query 参数相同的 URL）
  const seenClean = new Set<string>();
  const deduped: string[] = [];
  for (const url of finalUrls) {
    const clean = url.split("?")[0] ?? url;
    if (!seenClean.has(clean)) {
      seenClean.add(clean);
      deduped.push(url);
    }
  }

  if (!deduped.length) return null;

  return {
    image_urls: deduped,
    image_urls_watermark: Array.from(watermarkUrls),
    image_count: deduped.length,
    preview_url: deduped[0] ?? null,
    is_live: isLive,
  };
}

/**
 * 完整解析：分享链接 -> 无水印视频信息
 */
export async function parseVideo(shareUrl: string): Promise<ParseResult | null> {
  const videoId = await getVideoId(shareUrl);
  if (!videoId) return null;

  const data = await getAwemeDetail(videoId, shareUrl);
  if (!data) return null;

  const meta = extractVideoMeta(data);
  const result: ParseResult = { ...meta };

  if (meta.content_type === "video") {
    const qualities = extractVideoQualities(data);
    const nwmUrl = qualities.length > 0 ? qualities[0].url : null;
    result.nwm_url = nwmUrl;
    result.qualities = qualities;
    if (!nwmUrl && qualities.length === 0) return null;
  } else {
    const imageData = extractImageData(data);
    if (imageData) {
      result.image_data = imageData;
    } else {
      return null;
    }
  }

  return result;
}
