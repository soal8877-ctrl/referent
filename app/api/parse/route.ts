import { NextResponse } from "next/server";
import { ArticleFetchError, fetchArticle, isHttpUrl } from "@/lib/fetchArticle";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Нужен JSON с полем url." }, { status: 400 });
  }

  const url =
    typeof body === "object" && body && "url" in body && typeof body.url === "string"
      ? body.url.trim()
      : "";

  if (!url || !isHttpUrl(url)) {
    return NextResponse.json(
      { error: "Нужна ссылка вида https://example.com/article" },
      { status: 400 },
    );
  }

  try {
    const article = await fetchArticle(url);
    return NextResponse.json(article);
  } catch (error) {
    if (error instanceof ArticleFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Не удалось разобрать страницу." }, { status: 502 });
  }
}
