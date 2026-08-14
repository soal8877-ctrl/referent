import { NextResponse } from "next/server";
import { ArticleFetchError, fetchArticle, isHttpUrl } from "@/lib/fetchArticle";
import { completeChat } from "@/lib/openrouter";

export const runtime = "nodejs";

export const maxDuration = 120;

const MAX_CONTENT_CHARS = 6_000;

function readUrl(body: unknown): string {
  return typeof body === "object" && body && "url" in body && typeof body.url === "string"
    ? body.url.trim()
    : "";
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Нужен JSON с полем url." }, { status: 400 });
  }

  const url = readUrl(body);

  if (!url || !isHttpUrl(url)) {
    return NextResponse.json(
      { error: "Нужна ссылка вида https://example.com/article" },
      { status: 400 },
    );
  }

  try {
    const article = await fetchArticle(url);
    const source = [article.title, article.content].filter(Boolean).join("\n\n");

    if (!source) {
      return NextResponse.json({ error: "В статье нет текста для перевода." }, { status: 422 });
    }

    const truncated =
      source.length > MAX_CONTENT_CHARS
        ? `${source.slice(0, MAX_CONTENT_CHARS)}\n\n[Текст обрезан для перевода]`
        : source;

    const translation = await completeChat([
      {
        role: "system",
        content:
          "Ты переводчик. Переведи английский текст статьи на русский язык. Сохрани абзацы, смысл и тон. Не добавляй комментарии, пояснения и кавычки — только перевод.",
      },
      {
        role: "user",
        content: truncated,
      },
    ]);

    return NextResponse.json({
      date: article.date,
      title: article.title,
      translation,
    });
  } catch (error) {
    if (error instanceof ArticleFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Не удалось перевести статью.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
