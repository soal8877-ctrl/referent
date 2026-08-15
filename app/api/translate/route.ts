import { NextResponse } from "next/server";
import { AppError, messageForCode } from "@/lib/errors";
import { fetchArticle, isHttpUrl } from "@/lib/fetchArticle";
import { completeChat } from "@/lib/openrouter";

export const runtime = "nodejs";

export const maxDuration = 120;

const MAX_CONTENT_CHARS = 6_000;

function errorResponse(error: AppError) {
  return NextResponse.json(
    { code: error.code, error: messageForCode(error.code) },
    { status: error.status },
  );
}

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
    return errorResponse(new AppError("VALIDATION_BODY", 400));
  }

  const url = readUrl(body);

  if (!url || !isHttpUrl(url)) {
    return errorResponse(new AppError("VALIDATION_URL", 400));
  }

  try {
    const article = await fetchArticle(url);
    const source = [article.title, article.content].filter(Boolean).join("\n\n");

    if (!source) {
      throw new AppError("ARTICLE_EMPTY", 422);
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
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    return errorResponse(new AppError("UNKNOWN", 502));
  }
}
