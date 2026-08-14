"use client";

import { FormEvent, useState } from "react";

type Action = "summary" | "theses" | "telegram";

const ACTIONS: { id: Action; label: string }[] = [
  { id: "summary", label: "О чем статья?" },
  { id: "theses", label: "Тезисы" },
  { id: "telegram", label: "Пост для Telegram" },
];

const ACTION_TITLES: Record<Action, string> = {
  summary: "О чем статья",
  theses: "Тезисы",
  telegram: "Пост для Telegram",
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ReferentForm() {
  const [url, setUrl] = useState("");
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  async function runAction(action: Action) {
    const trimmed = url.trim();

    if (!trimmed) {
      setError("Вставьте адрес статьи.");
      return;
    }

    if (!isHttpUrl(trimmed)) {
      setError("Нужна ссылка вида https://example.com/article");
      return;
    }

    setError("");
    setActiveAction(action);
    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" && data && "error" in data && typeof data.error === "string"
            ? data.error
            : "Не удалось разобрать статью.";
        setError(message);
        return;
      }

      setResult(JSON.stringify(data, null, 2));
    } catch {
      setError("Не удалось связаться с сервером парсинга.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAction("summary");
  }

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
            placeholder="https://example.com/article"
            autoComplete="url"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
          />
        </label>

        {error ? (
          <p className="text-sm text-rose-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          {ACTIONS.map((item) => {
            const selected = activeAction === item.id && !loading;

            return (
              <button
                key={item.id}
                type="button"
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
      </form>

      <div className="min-h-56 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-zinc-400">Результат</h2>
          {activeAction ? (
            <span className="text-xs text-amber-400">
              {ACTION_TITLES[activeAction]}
            </span>
          ) : null}
        </div>

        {loading ? (
          <p className="text-zinc-300">Парсинг статьи…</p>
        ) : result ? (
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-6 text-zinc-100">
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
