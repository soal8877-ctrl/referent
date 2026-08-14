import { parseArticleHtml, type ParsedArticle } from "@/lib/parseArticle";

export type { ParsedArticle };

const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 15_000;

export class ArticleFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ArticleFetchError";
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchArticle(url: string): Promise<ParsedArticle> {
  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
  } catch (error) {
    const aborted =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ArticleFetchError(
      aborted ? "Сайт не ответил вовремя." : "Не удалось разобрать страницу.",
      502,
    );
  }

  if (!response.ok) {
    throw new ArticleFetchError(`Не удалось загрузить статью (${response.status}).`, 502);
  }

  const html = await response.text();
  if (html.length > MAX_HTML_BYTES) {
    throw new ArticleFetchError("Страница слишком большая для разбора.", 413);
  }

  const article = parseArticleHtml(html);

  if (!article.title && !article.content) {
    throw new ArticleFetchError("Не удалось найти заголовок и текст статьи.", 422);
  }

  return article;
}
