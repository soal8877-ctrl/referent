const OPENROUTER_URL = `${process.env.OPENAI_BASE_URL ?? "https://openrouter.ai/api/v1"}/chat/completions`;

const FREE_MODEL = "nvidia/nemotron-3-nano-30b-a3b:free";
const FREE_FALLBACKS = ["openai/gpt-oss-20b:free", "google/gemma-4-26b-a4b-it:free"];

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterResponse = {
  error?: { message?: string };
  choices?: { message?: { content?: string } }[];
};

export async function completeChat(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Не задан OPENROUTER_API_KEY.");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal: AbortSignal.timeout(90_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Referent",
    },
    body: JSON.stringify({
      model: FREE_MODEL,
      models: FREE_FALLBACKS,
      messages,
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  const data = (await response.json()) as OpenRouterResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenRouter ответил ${response.status}.`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content || content.length < 40) {
    throw new Error("Модель не вернула перевод.");
  }

  return content;
}
