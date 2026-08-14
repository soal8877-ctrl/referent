import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Referent",
  description: "ИИ переводчик, референт",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
