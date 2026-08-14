import { ArticleFetchError, fetchArticle } from "@/lib/fetchArticle";
import { completeChat } from "@/lib/openrouter";
import { buildArticleSource, buildGenerateMessages, type GenerateAction } from "@/lib/prompts";

const MAX_CONTENT_CHARS = 6_000;

export type GeneratedArticle = {
  date: string | null;
  title: string | null;
  text: string;
};

export async function generateFromArticle(
  url: string,
  action: GenerateAction,
): Promise<GeneratedArticle> {
  const article = await fetchArticle(url);
  const source = buildArticleSource(article.title, article.content);

  if (!source) {
    throw new ArticleFetchError("В статье нет текста для обработки.", 422);
  }

  const truncated =
    source.length > MAX_CONTENT_CHARS
      ? `${source.slice(0, MAX_CONTENT_CHARS)}\n\n[Текст обрезан]`
      : source;

  const text = await completeChat(buildGenerateMessages(action, truncated, url));

  return {
    date: article.date,
    title: article.title,
    text,
  };
}
