import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: string;
    book?: { id?: string; options?: unknown; pages?: unknown[] };
  };

  return NextResponse.json({
    ok: true,
    message: "AI 排版即将上线（当前为 Mock 响应）",
    received: {
      hasApiKey: Boolean(body.apiKey),
      bookId: body.book?.id ?? null,
      pagesCount: Array.isArray(body.book?.pages) ? body.book?.pages.length : 0,
      options: body.book?.options ?? null,
    },
  });
}
