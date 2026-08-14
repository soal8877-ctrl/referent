import { ArticleFetchError, fetchArticle } from "@/lib/fetchArticle";
import { completeChat } from "@/lib/openrouter";
import { buildArticleSource, buildGenerateMessages, finalizeTelegramPost, looksLikeReasoning, type GenerateAction } from "@/lib/prompts";

const MAX_CONTENT_CHARS = 6_000;
const TELEGRAM_SOURCE_CHARS = 2_500;

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

  const limit = action === "telegram" ? TELEGRAM_SOURCE_CHARS : MAX_CONTENT_CHARS;
  const truncated =
    source.length > limit ? `${source.slice(0, limit)}\n\n[Текст обрезан]` : source;

  const generated = await completeChat(buildGenerateMessages(action, truncated, url), {
    maxTokens: action === "telegram" ? 500 : 1200,
  });
  const text = action === "telegram" ? finalizeTelegramPost(generated, url) : generated;

  if (
    action === "telegram" &&
    (looksLikeReasoning(text) || text.replace(url, "").trim().length < 40)
  ) {
    throw new Error("Модель вернула черновик вместо поста. Нажмите кнопку ещё раз.");
  }

  return {
    date: article.date,
    title: article.title,
    text,
  };
}
