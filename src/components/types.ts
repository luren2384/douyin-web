export interface ApiResult {
  ok: boolean;
  data?: import("@/lib/douyin-parser").ParseResult;
  error?: string;
}
