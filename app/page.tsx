import { ReferentForm } from "@/components/ReferentForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">
          Referent
        </h1>
        <p className="text-zinc-400">
          Вставьте ссылку на англоязычную статью и получите краткое содержание,
          тезисы или пост для Telegram.
        </p>
      </header>
      <ReferentForm />
    </main>
  );
}
