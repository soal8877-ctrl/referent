import { NextResponse } from "next/server";
import { ArticleFetchError, isHttpUrl } from "@/lib/fetchArticle";
import { generateFromArticle } from "@/lib/generateFromArticle";
import { isGenerateAction } from "@/lib/prompts";

export const runtime = "nodejs";

export const maxDuration = 120;

function readBody(body: unknown): { url: string; action: unknown } {
  if (typeof body !== "object" || !body) {
    return { url: "", action: null };
  }

  const url = "url" in body && typeof body.url === "string" ? body.url.trim() : "";
  const action = "action" in body ? body.action : null;

  return { url, action };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Нужен JSON с полями url и action." }, { status: 400 });
  }

  const { url, action } = readBody(body);

  if (!url || !isHttpUrl(url)) {
    return NextResponse.json(
      { error: "Нужна ссылка вида https://example.com/article" },
      { status: 400 },
    );
  }

  if (!isGenerateAction(action)) {
    return NextResponse.json(
      { error: "Нужно действие: summary, theses или telegram." },
      { status: 400 },
    );
  }

  try {
    const result = await generateFromArticle(url, action);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ArticleFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Не удалось обработать статью.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
