/**
 * 本地存储管理 - 保存解析过的视频，用于视频转文字功能
 */

export interface SavedVideo {
  aweme_id: string;
  desc: string;
  author: string;
  cover: string;
  duration: number;
  video_url: string;
  saved_at: number;
  transcript?: string;
  transcribed_at?: number;
}

const STORAGE_KEY = "douyin_saved_videos";

export function getSavedVideos(): SavedVideo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedVideo[];
  } catch {
    return [];
  }
}

export function saveVideo(video: SavedVideo): void {
  if (typeof window === "undefined") return;
  const list = getSavedVideos();
  const idx = list.findIndex((v) => v.aweme_id === video.aweme_id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...video };
  } else {
    list.unshift(video);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function updateTranscript(
  awemeId: string,
  transcript: string
): void {
  if (typeof window === "undefined") return;
  const list = getSavedVideos();
  const idx = list.findIndex((v) => v.aweme_id === awemeId);
  if (idx >= 0) {
    list[idx].transcript = transcript;
    list[idx].transcribed_at = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
}

export function removeVideo(awemeId: string): void {
  if (typeof window === "undefined") return;
  const list = getSavedVideos().filter((v) => v.aweme_id !== awemeId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
