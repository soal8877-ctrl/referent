function envValue(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "");
}

function openRouterCompletionsUrl(): string {
  const base = (envValue("OPENAI_BASE_URL") || "https://openrouter.ai/api/v1").replace(
    /\/+$/,
    "",
  );
  return `${base}/chat/completions`;
}

function siteUrl(): string {
  const fromEnv = envValue("OPENROUTER_HTTP_REFERER");
  if (fromEnv) return fromEnv;

  const vercel =
    envValue("VERCEL_PROJECT_PRODUCTION_URL") || envValue("VERCEL_URL");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;

  return "http://localhost:3000";
}

const FREE_MODELS = [
  envValue("OPENROUTER_MODEL"),
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "openrouter/free",
].filter((id, index, list) => id && list.indexOf(id) === index);

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterResponse = {
  error?: { message?: string; code?: number | string };
  choices?: { message?: { content?: string; reasoning?: string } }[];
};

export async function completeChat(
  messages: ChatMessage[],
  options?: { maxTokens?: number },
): Promise<string> {
  const apiKey = envValue("OPENROUTER_API_KEY");

  if (!apiKey) {
    throw new Error("Не задан OPENROUTER_API_KEY.");
  }

  let lastError = "Бесплатная модель OpenRouter сейчас недоступна.";

  for (const model of FREE_MODELS) {
    try {
      const content = await requestCompletion(model, messages, apiKey, options?.maxTokens ?? 1200);
      if (content.length >= 40) {
        return content;
      }
      lastError = "Модель не вернула ответ.";
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(friendlyOpenRouterError(lastError));
}

async function requestCompletion(
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  maxTokens: number,
): Promise<string> {
  const response = await fetch(openRouterCompletionsUrl(), {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl(),
      "X-Title": "Referent",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      provider: { allow_fallbacks: true },
    }),
  });

  const data = (await response.json()) as OpenRouterResponse;
  const message = data.error?.message || `OpenRouter ответил ${response.status}.`;

  if (!response.ok) {
    throw new Error(message);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Модель не вернула ответ.");
  }

  return content;
}

function friendlyOpenRouterError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("provider returned error") || lower.includes("unavailable") || lower.includes("overloaded")) {
    return "Бесплатная модель OpenRouter сейчас недоступна. Подождите минуту и нажмите кнопку ещё раз.";
  }

  if (lower.includes("rate") || lower.includes("429") || lower.includes("quota")) {
    return "Лимит бесплатных запросов OpenRouter исчерпан. Попробуйте позже.";
  }

  if (lower.includes("api key") || lower.includes("unauthorized") || lower.includes("401")) {
    return "Проверьте OPENROUTER_API_KEY в переменных окружения Vercel.";
  }

  return message;
}
