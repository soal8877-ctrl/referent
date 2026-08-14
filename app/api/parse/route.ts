import { NextResponse } from "next/server";
import { parseArticleHtml } from "@/lib/parseArticle";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 15_000;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Не удалось загрузить статью (${response.status}).` },
        { status: 502 },
      );
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "Страница слишком большая для разбора." }, { status: 413 });
    }

    const article = parseArticleHtml(html);

    if (!article.title && !article.content) {
      return NextResponse.json(
        { error: "Не удалось найти заголовок и текст статьи." },
        { status: 422 },
      );
    }

    return NextResponse.json(article);
  } catch (error) {
    const aborted =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

    return NextResponse.json(
      { error: aborted ? "Сайт не ответил вовремя." : "Не удалось разобрать страницу." },
      { status: 502 },
    );
  }
}
