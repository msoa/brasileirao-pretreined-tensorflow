import Link from "next/link";
import { ReactNode } from "react";

const LINKS = [
  { href: "/#dashboard", label: "Base de dados e modelo" },
  { href: "/#treinamento", label: "Treinamento" },
  { href: "/#previsoes", label: "Previsões" },
  { href: "/#exploracao", label: "Exploração" },
  { href: "/#sobre-mim", label: "Sobre mim" },
  { href: "/#aviso", label: "Aviso" },
  { href: "/#ajuda", label: "Ajuda" },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen w-full">
      <header className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold">Brasileirão Predictor</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border px-3 py-1 text-sm transition-colors hover:opacity-80"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
