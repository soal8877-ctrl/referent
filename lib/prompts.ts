export type GenerateAction = "summary" | "theses" | "telegram";

const GENERATE_ACTIONS: GenerateAction[] = ["summary", "theses", "telegram"];

const SYSTEM_PROMPTS: Record<GenerateAction, string> = {
  summary:
    "Ты референт. Напиши краткое содержание статьи на русском языке.\n\nПравила:\n- ровно 1 или 2 абзаца связного текста;\n- без списков, заголовков, нумерации и буллетов;\n- без воды и вступлений вроде «статья рассказывает» или «автор пишет»;\n- передай тему, главную мысль и вывод;\n- не добавляй ничего от себя — только пересказ.",
  theses:
    "Ты референт. Выпиши тезисы статьи на русском языке.\n\nПравила:\n- ровно 5–8 пунктов нумерованным списком: 1. 2. 3. …;\n- один пункт — одна законченная мысль;\n- не копируй абзацы статьи, сжимай факты и выводы;\n- без заголовка, вступления, заключения и пустых строк между пунктами;\n- не пиши связный пересказ — только список.",
  telegram:
    "Ты редактор Telegram-канала. Напиши короткий пост на русском (500–900 знаков): заголовок, 2–3 абзаца или тезиса, в конце исходная ссылка. Живой тон, без канцелярита и без хештегов. Только текст поста.",
};

export function isGenerateAction(value: unknown): value is GenerateAction {
  return typeof value === "string" && GENERATE_ACTIONS.includes(value as GenerateAction);
}

export function buildArticleSource(
  title: string | null,
  content: string | null,
): string {
  const parts: string[] = [];

  if (title?.trim()) {
    parts.push(`Заголовок: ${title.trim()}`);
  }

  if (content?.trim()) {
    parts.push(`Текст статьи:\n${content.trim()}`);
  }

  return parts.join("\n\n");
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
