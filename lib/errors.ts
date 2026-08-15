export type ErrorCode =
  | "VALIDATION_URL"
  | "VALIDATION_ACTION"
  | "VALIDATION_BODY"
  | "ARTICLE_FETCH"
  | "ARTICLE_TOO_LARGE"
  | "ARTICLE_EMPTY"
  | "AI_UNAVAILABLE"
  | "AI_RATE_LIMIT"
  | "AI_CONFIG"
  | "AI_EMPTY"
  | "AI_BAD_OUTPUT"
  | "NETWORK"
  | "UNKNOWN";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_URL: "Проверьте адрес статьи. Нужна ссылка вида https://example.com/article",
  VALIDATION_ACTION: "Выберите одно из действий: краткое содержание, тезисы или пост.",
  VALIDATION_BODY: "Некорректный запрос. Обновите страницу и попробуйте снова.",
  ARTICLE_FETCH: "Не удалось загрузить статью по этой ссылке.",
  ARTICLE_TOO_LARGE: "Страница слишком большая для разбора. Попробуйте другую ссылку.",
  ARTICLE_EMPTY: "По ссылке не удалось найти текст статьи.",
  AI_UNAVAILABLE: "Сервис генерации временно недоступен. Подождите минуту и попробуйте снова.",
  AI_RATE_LIMIT: "Слишком много запросов. Подождите немного и нажмите кнопку ещё раз.",
  AI_CONFIG: "Сервис генерации не настроен. Проверьте ключ OpenRouter.",
  AI_EMPTY: "Не удалось получить ответ. Попробуйте ещё раз.",
  AI_BAD_OUTPUT: "Не удалось подготовить результат. Нажмите кнопку ещё раз.",
  NETWORK: "Нет связи с сервером. Проверьте интернет и попробуйте снова.",
  UNKNOWN: "Что-то пошло не так. Попробуйте ещё раз.",
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number = 400,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "AppError";
  }
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}

export function messageForCode(code: ErrorCode): string {
  return ERROR_MESSAGES[code];
}

export function messageFromApiPayload(data: unknown, status?: number): string {
  if (typeof data === "object" && data && "code" in data && isErrorCode(data.code)) {
    return messageForCode(data.code);
  }

  if (status === 404 || status === 408 || status === 502 || status === 503 || status === 504) {
    return messageForCode("ARTICLE_FETCH");
  }

  return messageForCode("UNKNOWN");
}
