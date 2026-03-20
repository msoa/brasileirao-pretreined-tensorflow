"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";

type PredictResult = {
  prediction: "HOME" | "DRAW" | "AWAY";
  probabilities: Record<string, number>;
};

const PROBABILITY_COLUMNS = [
  { key: "HOME", label: "Mandante" },
  { key: "DRAW", label: "Empate" },
  { key: "AWAY", label: "Visitante" },
];

export function PredictionsContent() {
  const [teams, setTeams] = useState<string[]>([]);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeams() {
      const response = await fetch("/api/data/teams");
      const data = await response.json();
      const loadedTeams: string[] = data.teams ?? [];
      setTeams(loadedTeams);
      setHomeTeam((current) => current || loadedTeams[0] || "");
      setAwayTeam((current) => current || loadedTeams[1] || "");
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
        body: JSON.stringify({ homeTeam, awayTeam }),
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
      <section className="card-neon">
        <h2 className="text-base font-semibold">Predizer partida</h2>
        <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Mandante</span>
            <select
              value={homeTeam}
              onChange={(event) => setHomeTeam(event.target.value)}
              className="select-neon"
            >
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Visitante</span>
            <select
              value={awayTeam}
              onChange={(event) => setAwayTeam(event.target.value)}
              className="select-neon"
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
              disabled={loading || !homeTeam || !awayTeam || homeTeam === awayTeam}
              className="btn-primary"
            >
              {loading ? "Predizendo..." : "Executar predição"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-4 card-neon">
        <h3 className="text-base font-semibold">Resultado</h3>
        {error ? <p className="mt-2 text-sm">Erro: {error}</p> : null}
        {result ? (
          <div className="mt-2 text-sm text-muted">
            <p>
              Classe prevista: <strong>{result.prediction}</strong>
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {PROBABILITY_COLUMNS.map((column) => {
                const value = result.probabilities[column.key] ?? 0;
                return (
                  <article key={column.key} className="card-neon-sm text-sm">
                    <p className="text-xs text-muted">{column.label}</p>
                    <p className="text-sm font-semibold">{(value * 100).toFixed(2)}%</p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Nenhuma predição executada.</p>
        )}
      </section>
    </>
  );
}

export default function PredictionsPage() {
  return (
    <AppShell>
      <PredictionsContent />
    </AppShell>
  );
}
