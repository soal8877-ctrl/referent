export type GenerateAction = "summary" | "theses" | "telegram";

const GENERATE_ACTIONS: GenerateAction[] = ["summary", "theses", "telegram"];

const SYSTEM_PROMPTS: Record<GenerateAction, string> = {
  summary:
    "Ты референт. По статье кратко ответь на русском, о чём она. 1–2 абзаца связного текста, без списков, заголовков и предисловий. Только содержание.",
  theses:
    "Ты референт. Выпиши на русском 5–8 тезисов статьи нумерованным списком. Один пункт — одна мысль. Не копируй абзацы, сжимай факты и выводы. Без вступления и заключения.",
  telegram:
    "Ты редактор Telegram-канала. Напиши короткий пост на русском (500–900 знаков): заголовок, 2–3 абзаца или тезиса, в конце исходная ссылка. Живой тон, без канцелярита и без хештегов. Только текст поста.",
};

export function isGenerateAction(value: unknown): value is GenerateAction {
  return typeof value === "string" && GENERATE_ACTIONS.includes(value as GenerateAction);
}

export function buildGenerateMessages(
  action: GenerateAction,
  source: string,
  url: string,
): { role: "system" | "user"; content: string }[] {
  const userContent =
    action === "telegram" ? `Ссылка на статью: ${url}\n\n${source}` : source;

  return [
    { role: "system", content: SYSTEM_PROMPTS[action] },
    { role: "user", content: userContent },
  ];
}
