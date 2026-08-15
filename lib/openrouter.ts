import { AppError } from "@/lib/errors";

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

  const vercel = envValue("VERCEL_PROJECT_PRODUCTION_URL") || envValue("VERCEL_URL");
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
    throw new AppError("AI_CONFIG", 500);
  }

  let lastCode: "AI_UNAVAILABLE" | "AI_RATE_LIMIT" | "AI_EMPTY" | "AI_CONFIG" = "AI_UNAVAILABLE";

  for (const model of FREE_MODELS) {
    try {
      const content = await requestCompletion(model, messages, apiKey, options?.maxTokens ?? 1200);
      if (content.length >= 40) {
        return content;
      }
      lastCode = "AI_EMPTY";
    } catch (error) {
      if (error instanceof AppError) {
        lastCode = error.code as typeof lastCode;
        if (error.code === "AI_CONFIG") {
          throw error;
        }
      } else {
        lastCode = "AI_UNAVAILABLE";
      }
    }
  }

  throw new AppError(lastCode, lastCode === "AI_RATE_LIMIT" ? 429 : 502);
}

async function requestCompletion(
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  maxTokens: number,
): Promise<string> {
  let response: Response;

  try {
    response = await fetch(openRouterCompletionsUrl(), {
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
  } catch {
    throw new AppError("AI_UNAVAILABLE", 502);
  }

  let data: OpenRouterResponse = {};
  try {
    data = (await response.json()) as OpenRouterResponse;
  } catch {
    throw new AppError("AI_UNAVAILABLE", 502);
  }

  if (!response.ok) {
    throw new AppError(classifyOpenRouterFailure(response.status, data.error?.message), response.status);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new AppError("AI_EMPTY", 502);
  }

  return content;
}

function classifyOpenRouterFailure(
  status: number,
  message?: string,
): "AI_UNAVAILABLE" | "AI_RATE_LIMIT" | "AI_CONFIG" {
  const lower = (message ?? "").toLowerCase();

  if (status === 401 || status === 403 || lower.includes("api key") || lower.includes("unauthorized")) {
    return "AI_CONFIG";
  }

  if (status === 429 || lower.includes("rate") || lower.includes("quota")) {
    return "AI_RATE_LIMIT";
  }

  return "AI_UNAVAILABLE";
}
