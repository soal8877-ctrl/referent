import { ReferentForm } from "@/components/ReferentForm";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl min-w-0 flex-col justify-start gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10 md:px-8 md:py-12">
      <header className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight break-words text-foreground sm:text-4xl">
            Referent
          </h1>
          <ThemeToggle />
        </div>
        <p className="text-sm leading-relaxed text-pretty text-muted sm:text-base">
          Вставьте ссылку на англоязычную статью и получите краткое содержание,
          тезисы или пост для Telegram.
        </p>
      </header>
      <ReferentForm />
    </main>
  );
}
