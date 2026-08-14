export type GenerateAction = "summary" | "theses" | "telegram";

const GENERATE_ACTIONS: GenerateAction[] = ["summary", "theses", "telegram"];

const SYSTEM_PROMPTS: Record<GenerateAction, string> = {
  summary:
    "Ты референт. Напиши краткое содержание статьи на русском языке.\n\nПравила:\n- ровно 1 или 2 абзаца связного текста;\n- без списков, заголовков, нумерации и буллетов;\n- без воды и вступлений вроде «статья рассказывает» или «автор пишет»;\n- передай тему, главную мысль и вывод;\n- не добавляй ничего от себя — только пересказ.",
  theses:
    "Ты референт. Выпиши тезисы статьи на русском языке.\n\nПравила:\n- ровно 5–8 пунктов нумерованным списком: 1. 2. 3. …;\n- один пункт — одна законченная мысль;\n- не копируй абзацы статьи, сжимай факты и выводы;\n- без заголовка, вступления, заключения и пустых строк между пунктами;\n- не пиши связный пересказ — только список.",
  telegram:
    "Ты пишешь посты в Telegram. Сразу выдай готовый пост на русском. Запрещено: рассуждения, план, разбор правил, английский текст, цитаты оригинала, перевод статьи целиком.",
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
    action === "telegram"
      ? `Сделай короткий пост по статье. Формат:\n1) заголовок с одним эмодзи\n2) два коротких абзаца на русском, ещё 2 эмодзи в тексте\n3) последняя строка — эта ссылка: ${url}\n\n500–800 знаков. Начинай сразу с заголовка.\n\n${source}`
      : source;

  return [
    { role: "system", content: SYSTEM_PROMPTS[action] },
    { role: "user", content: userContent },
  ];
}

export function ensureSourceUrl(text: string, url: string): string {
  const trimmed = text.trim();
  return trimmed.includes(url) ? trimmed : `${trimmed}\n\n${url}`;
}

function latinShare(text: string): number {
  const letters = text.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, "");
  if (!letters.length) return 0;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return latin / letters.length;
}

const REASONING_RE =
  /we need to|the instruction|let's craft|chain of thought|system prompt|so we can have|craft a post|формат:\n1\)/i;

export function looksLikeReasoning(text: string): boolean {
  const withoutUrl = text.replace(/https?:\/\/\S+/gi, "").trim();
  return REASONING_RE.test(withoutUrl.slice(0, 600)) || latinShare(withoutUrl) > 0.5;
}

function stripReasoning(text: string): string {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();

  const lines = cleaned.split("\n");
  const start = lines.findIndex((line) => {
    const value = line.trim();
    if (!value) return false;
    if (REASONING_RE.test(value)) return false;
    if (latinShare(value) >= 0.45) return false;
    return /[а-яё]/i.test(value);
  });

  return (start >= 0 ? lines.slice(start) : lines).join("\n").trim();
}

export function finalizeTelegramPost(text: string, url: string): string {
  const stripped = stripReasoning(text);
  const blocks = stripped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => {
      if (block.includes(url) || /^https?:\/\//i.test(block)) return true;
      if (REASONING_RE.test(block)) return false;
      return latinShare(block) < 0.45;
    });

  let body = blocks
    .filter((block) => !block.includes(url) && !/^https?:\/\//i.test(block))
    .join("\n\n")
    .trim();

  if (looksLikeReasoning(body)) {
    body = "";
  }

  if (body.length > 900) {
    const clipped = body.slice(0, 900);
    const lastBreak = Math.max(clipped.lastIndexOf("\n\n"), clipped.lastIndexOf(". "));
    body = (lastBreak > 400 ? clipped.slice(0, lastBreak + 1) : clipped).trim();
  }

  return ensureSourceUrl(body, url);
}
