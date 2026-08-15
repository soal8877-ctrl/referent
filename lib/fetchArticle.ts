import { AppError } from "@/lib/errors";
import { parseArticleHtml, type ParsedArticle } from "@/lib/parseArticle";

export type { ParsedArticle };

const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 15_000;

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
  } catch {
    throw new AppError("ARTICLE_FETCH", 502);
  }

  if (!response.ok) {
    throw new AppError("ARTICLE_FETCH", response.status >= 400 ? response.status : 502);
  }

  const html = await response.text();
  if (html.length > MAX_HTML_BYTES) {
    throw new AppError("ARTICLE_TOO_LARGE", 413);
  }

  const article = parseArticleHtml(html);

  if (!article.title && !article.content) {
    throw new AppError("ARTICLE_EMPTY", 422);
  }

  return article;
}
