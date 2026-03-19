"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";

type PredictResult = {
  prediction: "MANDANTE" | "EMPATE" | "VISITANTE";
  probabilities: Record<string, number>;
};

const PROBABILITY_COLUMNS = [
  { key: "MANDANTE", label: "Mandante" },
  { key: "EMPATE", label: "Empate" },
  { key: "VISITANTE", label: "Visitante" },
];

export function PrevisoesContent() {
  const [teams, setTeams] = useState<string[]>([]);
  const [mandante, setMandante] = useState("");
  const [visitante, setVisitante] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeams() {
      const response = await fetch("/api/data/teams");
      const data = await response.json();
      const loadedTeams: string[] = data.teams ?? [];
      setTeams(loadedTeams);
      setMandante((current) => current || loadedTeams[0] || "");
      setVisitante((current) => current || loadedTeams[1] || "");
    }
    void loadTeams();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ml/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandante, visitante }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? "Falha ao predizer");
      }
      setResult(data);
    } catch (predictionError) {
      setError(predictionError instanceof Error ? predictionError.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-black/10 p-4 dark:border-white/20">
        <h2 className="text-base font-semibold">Predizer partida</h2>
        <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-black/70 dark:text-white/70">Mandante</span>
            <select
              value={mandante}
              onChange={(event) => setMandante(event.target.value)}
              className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
            >
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-black/70 dark:text-white/70">Visitante</span>
            <select
              value={visitante}
              onChange={(event) => setVisitante(event.target.value)}
              className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
            >
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading || !mandante || !visitante || mandante === visitante}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
            >
              {loading ? "Predizendo..." : "Executar predição"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-4 rounded-xl border border-black/10 p-4 dark:border-white/20">
        <h3 className="text-base font-semibold">Resultado</h3>
        {error ? <p className="mt-2 text-sm">Erro: {error}</p> : null}
        {result ? (
          <div className="mt-2 text-sm text-black/80 dark:text-white/80">
            <p>
              Classe prevista: <strong>{result.prediction}</strong>
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {PROBABILITY_COLUMNS.map((column) => {
                const value = result.probabilities[column.key] ?? 0;
                return (
                  <article key={column.key} className="rounded-lg border border-black/10 p-2 dark:border-white/20">
                    <p className="text-xs text-black/70 dark:text-white/70">{column.label}</p>
                    <p className="text-sm font-semibold">{(value * 100).toFixed(2)}%</p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-black/70 dark:text-white/70">Nenhuma predição executada.</p>
        )}
      </section>
    </>
  );
}

export default function PrevisoesPage() {
  return (
    <AppShell title="Previsões">
      <PrevisoesContent />
    </AppShell>
  );
}
