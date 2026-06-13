import { NextRequest, NextResponse } from "next/server";
import { parseVideo } from "@/lib/douyin-parser";

// 强制动态渲染，避免静态优化
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url: string = body?.url ?? "";

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { ok: false, error: "请提供有效的抖音分享链接" },
        { status: 400 }
      );
    }

    const result = await parseVideo(url);

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "解析失败，请检查链接是否正确或 Cookie 是否有效" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "服务器内部错误" },
      { status: 500 }
    );
  }
}
