"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { messageForCode, messageFromApiPayload, type ErrorCode } from "@/lib/errors";

type Action = "summary" | "theses" | "telegram";

const ACTIONS: { id: Action; label: string; title: string }[] = [
  {
    id: "summary",
    label: "О чем статья?",
    title: "Кратко пересказать, о чём статья",
  },
  {
    id: "theses",
    label: "Тезисы",
    title: "Выписать главные тезисы статьи списком",
  },
  {
    id: "telegram",
    label: "Пост для Telegram",
    title: "Сделать короткий пост для Telegram со ссылкой на источник",
  },
];

const ACTION_TITLES: Record<Action, string> = {
  summary: "О чем статья",
  theses: "Тезисы",
  telegram: "Пост для Telegram",
};

const PROCESS_STATUSES: Record<Action, string> = {
  summary: "Загружаю статью… Готовлю краткое содержание…",
  theses: "Загружаю статью… Собираю тезисы…",
  telegram: "Загружаю статью… Пишу пост для Telegram…",
};

const secondaryButtonClass =
  "rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-amber-400/70 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function resultFrom(data: unknown): string {
  if (typeof data !== "object" || !data) return "";
  return "text" in data && typeof data.text === "string" ? data.text.trim() : "";
}

export function ReferentForm() {
  const [url, setUrl] = useState("");
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldScrollRef.current || !result) return;

    shouldScrollRef.current = false;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  function showError(code: ErrorCode) {
    setError(messageForCode(code));
  }

  function clearAll() {
    setUrl("");
    setActiveAction(null);
    setLoading(false);
    setError("");
    setResult("");
    setCopied(false);
    shouldScrollRef.current = false;

    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }

  async function copyResult() {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);

      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }

      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      showError("UNKNOWN");
    }
  }

  async function runAction(action: Action) {
    const trimmed = url.trim();

    if (!trimmed) {
      showError("VALIDATION_URL");
      return;
    }

    if (!isHttpUrl(trimmed)) {
      showError("VALIDATION_URL");
      return;
    }

    setError("");
    setActiveAction(action);
    setLoading(true);
    setResult("");
    setCopied(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, action }),
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        showError("UNKNOWN");
        return;
      }

      if (!response.ok) {
        setError(messageFromApiPayload(data, response.status));
        return;
      }

      const text = resultFrom(data);
      if (!text) {
        showError("AI_EMPTY");
        return;
      }

      shouldScrollRef.current = true;
      setResult(text);
    } catch {
      showError("NETWORK");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const processStatus =
    loading && activeAction ? PROCESS_STATUSES[activeAction] : null;

  return (
    <section className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-300">
            URL англоязычной статьи
          </span>
          <input
            type="url"
            name="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Введите URL статьи, например: https://example.com/article"
            autoComplete="url"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
          />
          <span className="text-xs text-zinc-500">
            Укажите ссылку на англоязычную статью
          </span>
        </label>

        {error ? (
          <Alert variant="destructive">
            <AlertIcon />
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          {ACTIONS.map((item) => {
            const selected = activeAction === item.id && !loading;

            return (
              <button
                key={item.id}
                type="button"
                title={item.title}
                disabled={loading}
                onClick={() => void runAction(item.id)}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60 ${
                  selected
                    ? "border-amber-400 bg-amber-400 text-zinc-950"
                    : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-amber-400/70 hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          title="Сбросить поле URL, результат и ошибки"
          disabled={loading}
          onClick={clearAll}
          className={secondaryButtonClass}
        >
          Очистить
        </button>
      </form>

      {processStatus ? (
        <div
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300"
          role="status"
          aria-live="polite"
        >
          {processStatus}
        </div>
      ) : null}

      <div
        ref={resultRef}
        className="min-h-56 scroll-mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-zinc-400">Результат</h2>
            {activeAction && !loading ? (
              <span className="text-xs text-amber-400">
                {ACTION_TITLES[activeAction]}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            title="Скопировать результат"
            disabled={!result || loading}
            onClick={() => void copyResult()}
            className={secondaryButtonClass}
          >
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>

        {result ? (
          <pre className="overflow-x-auto whitespace-pre-wrap font-sans text-base leading-7 text-zinc-100">
            {result}
          </pre>
        ) : (
          <p className="text-zinc-500">
            Вставьте ссылку и нажмите одну из кнопок — ответ появится здесь.
          </p>
        )}
      </div>
    </section>
  );
}
