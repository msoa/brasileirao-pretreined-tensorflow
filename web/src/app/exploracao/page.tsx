"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type MatchRow = {
  ID: string;
  rodata: string;
  data: string;
  mandante: string;
  visitante: string;
  mandante_Placar: string;
  visitante_Placar: string;
  vencedor: string;
};

type StandingEntry = {
  team: string;
  points: number;
  wins: number;
  goalDiff: number;
  goalsFor: number;
  goalsAgainst: number;
  played: number;
};

type TeamStatus = {
  type: "ELIMINADO" | "CAMPEAO" | "VICE" | "TERCEIRO" | "QUARTO" | "OUTRO";
  message: string;
};

type TeamSummary = {
  goalsFor: number;
  goalsAgainst: number;
  matchesWon: number;
  matchesDrawn: number;
  matchesLost: number;
  topScorers: Array<{
    player: string;
    goals: number;
  }>;
};

function AccordionChevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="accordion-arrow h-4 w-4 transition-transform group-open:rotate-180"
    >
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function getStatusBadgeClass(statusType: TeamStatus["type"]): string {
  if (statusType === "ELIMINADO") {
    return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
  }

  if (statusType === "CAMPEAO") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300";
  }

  if (statusType === "VICE") {
    return "border-slate-500/40 bg-slate-500/15 text-slate-800 dark:text-slate-300";
  }

  if (statusType === "TERCEIRO") {
    return "border-orange-700/40 bg-orange-700/15 text-orange-800 dark:text-orange-300";
  }

  if (statusType === "QUARTO") {
    return "border-sky-600/40 bg-sky-600/15 text-sky-800 dark:text-sky-300";
  }

  return "border-black/20 bg-black/5 text-black/80 dark:border-white/20 dark:bg-white/10 dark:text-white/80";
}

function parseScore(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFinalStandings(matches: MatchRow[]): StandingEntry[] {
  const map = new Map<string, StandingEntry>();

  function ensureTeam(team: string) {
    const current = map.get(team);
    if (current) return current;

    const created: StandingEntry = {
      team,
      points: 0,
      wins: 0,
      goalDiff: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      played: 0,
    };

    map.set(team, created);
    return created;
  }

  for (const match of matches) {
    const home = ensureTeam(match.mandante);
    const away = ensureTeam(match.visitante);

    const homeGoals = parseScore(match.mandante_Placar);
    const awayGoals = parseScore(match.visitante_Placar);

    home.played += 1;
    away.played += 1;

    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    home.goalDiff = home.goalsFor - home.goalsAgainst;
    away.goalDiff = away.goalsFor - away.goalsAgainst;

    if (homeGoals > awayGoals) {
      home.points += 3;
      home.wins += 1;
    } else if (homeGoals < awayGoals) {
      away.points += 3;
      away.wins += 1;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  return Array.from(map.values()).sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (right.wins !== left.wins) return right.wins - left.wins;
    if (right.goalDiff !== left.goalDiff) return right.goalDiff - left.goalDiff;
    if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor;
    return left.team.localeCompare(right.team);
  });
}

function getTeamStatus(selectedTeam: string, yearMatches: MatchRow[], standings: StandingEntry[]): TeamStatus | null {
  if (!selectedTeam) {
    return null;
  }

  const maxRound = Math.max(...yearMatches.map((match) => Number(match.rodata) || 0), 0);
  const teamMatches = yearMatches.filter(
    (match) => match.mandante === selectedTeam || match.visitante === selectedTeam,
  );

  if (teamMatches.length === 0) {
    return {
      type: "OUTRO",
      message: "Time sem partidas registradas no ano selecionado.",
    };
  }

  const teamLastRound = Math.max(...teamMatches.map((match) => Number(match.rodata) || 0), 0);

  if (teamLastRound < maxRound) {
    return {
      type: "ELIMINADO",
      message: `Eliminado na rodada ${teamLastRound}.`,
    };
  }

  const position = standings.findIndex((entry) => entry.team === selectedTeam) + 1;

  if (position === 1) {
    return { type: "CAMPEAO", message: "Campeão" };
  }
  if (position === 2) {
    return { type: "VICE", message: "Vice-campeão" };
  }
  if (position === 3) {
    return { type: "TERCEIRO", message: "3º lugar" };
  }
  if (position === 4) {
    return { type: "QUARTO", message: "4º lugar" };
  }

  return {
    type: "OUTRO",
    message: `${position}º lugar`,
  };
}

function getRankLabel(position: number): string {
  if (position === 1) return "Campeão";
  if (position === 2) return "Vice-campeão";
  if (position === 3) return "3º lugar";
  if (position === 4) return "4º lugar";
  return `${position}º lugar`;
}

export function ExploracaoContent() {
  const [years, setYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [yearMatches, setYearMatches] = useState<MatchRow[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadYears = useCallback(async () => {
    const response = await fetch("/api/data/years");
    const data = await response.json();
    const loadedYears: string[] = data.years ?? [];

    setYears(loadedYears);
    if (loadedYears.length > 0) {
      setSelectedYear((current) => (current && loadedYears.includes(current) ? current : loadedYears[0]));
    }
  }, []);

  const loadTeams = useCallback(async (year: string) => {
    if (!year) {
      setTeams([]);
      return;
    }

    const response = await fetch(`/api/data/teams?year=${year}`);
    const data = await response.json();
    const loadedTeams: string[] = data.teams ?? [];
    setTeams(loadedTeams);
    setSelectedTeam((current) => (current && loadedTeams.includes(current) ? current : ""));
  }, []);

  const loadMatches = useCallback(async () => {
    if (!selectedYear) {
      return;
    }

    setLoading(true);

    try {
      const filteredParams = new URLSearchParams();
      filteredParams.set("year", selectedYear);
      if (selectedTeam) {
        filteredParams.set("team", selectedTeam);
      }

      const allParams = new URLSearchParams();
      allParams.set("year", selectedYear);

      const [filteredResponse, allResponse] = await Promise.all([
        fetch(`/api/data/matches?${filteredParams.toString()}`),
        fetch(`/api/data/matches?${allParams.toString()}`),
      ]);

      const filteredData = await filteredResponse.json();
      const allData = await allResponse.json();

      setMatches(filteredData.matches ?? []);
      setYearMatches(allData.matches ?? []);

      if (selectedTeam) {
        const summaryParams = new URLSearchParams();
        summaryParams.set("year", selectedYear);
        summaryParams.set("team", selectedTeam);

        const summaryResponse = await fetch(`/api/data/team-summary?${summaryParams.toString()}`);
        const summaryData = await summaryResponse.json();

        setTeamSummary({
          goalsFor: Number(summaryData.goalsFor) || 0,
          goalsAgainst: Number(summaryData.goalsAgainst) || 0,
          matchesWon: Number(summaryData.matchesWon) || 0,
          matchesDrawn: Number(summaryData.matchesDrawn) || 0,
          matchesLost: Number(summaryData.matchesLost) || 0,
          topScorers: Array.isArray(summaryData.topScorers) ? summaryData.topScorers : [],
        });
      } else {
        setTeamSummary(null);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedTeam]);

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  useEffect(() => {
    if (!selectedYear) return;
    void loadTeams(selectedYear);
  }, [loadTeams, selectedYear]);

  useEffect(() => {
    if (!selectedYear) return;
    void loadMatches();
  }, [loadMatches, selectedYear]);

  const groupedByRound = useMemo(() => {
    const map = new Map<number, MatchRow[]>();

    for (const match of matches) {
      const round = Number(match.rodata) || 0;
      const current = map.get(round) ?? [];
      current.push(match);
      map.set(round, current);
    }

    return Array.from(map.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([round, roundMatches]) => ({ round, matches: roundMatches }));
  }, [matches]);

  const gameColumns = useMemo(() => {
    const maxMatchesInRound = Math.max(
      ...groupedByRound.map((group) => group.matches.length),
      0,
    );

    return Array.from({ length: maxMatchesInRound }, (_, index) => index + 1);
  }, [groupedByRound]);

  const standings = useMemo(() => buildFinalStandings(yearMatches), [yearMatches]);

  const topFourTeams = useMemo(() => standings.slice(0, 4), [standings]);

  const teamStatus = useMemo(
    () => getTeamStatus(selectedTeam, yearMatches, standings),
    [selectedTeam, standings, yearMatches],
  );

  const stats = useMemo(() => {
    const total = matches.length;
    const rounds = groupedByRound.length;
    const wins = matches.filter((match) => match.vencedor && match.vencedor !== "-").length;
    return { total, rounds, wins };
  }, [groupedByRound.length, matches]);

  return (
    <>
      <section className="card-neon">
        <h2 className="text-base font-semibold">Filtros</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Ano (obrigatório)</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="select-neon"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-muted">Time (opcional)</span>
            <select
              value={selectedTeam}
              onChange={(event) => setSelectedTeam(event.target.value)}
              className="select-neon"
            >
              <option value="">Todos</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadMatches()}
              className="btn-primary"
            >
              Aplicar
            </button>
          </div>
        </div>
      </section>

      <details className="group mt-4 card-neon text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
          <span>Resumo geral</span>
          <AccordionChevron />
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <article className="card-neon">
            <p className="text-sm text-muted">Partidas</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </article>
          <article className="card-neon">
            <p className="text-sm text-muted">Rodadas</p>
            <p className="text-2xl font-semibold">{stats.rounds}</p>
          </article>
          <article className="card-neon">
            <p className="text-sm text-muted">Jogos decididos (sem empate)</p>
            <p className="text-2xl font-semibold">{stats.wins}</p>
          </article>
        </div>
      </details>

      {selectedTeam && teamStatus ? (
        <details className="group mt-4 card-neon text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
            <span>Status do time filtrado</span>
            <AccordionChevron />
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-muted">{selectedTeam}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(teamStatus.type)}`}
            >
              {teamStatus.message}
            </span>
          </div>

          {teamSummary ? (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="card-neon-sm">
                  <p className="text-xs text-muted">Gols feitos</p>
                  <p className="text-lg font-semibold">{teamSummary.goalsFor}</p>
                </article>
                <article className="card-neon-sm">
                  <p className="text-xs text-muted">Gols recebidos</p>
                  <p className="text-lg font-semibold">{teamSummary.goalsAgainst}</p>
                </article>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <article className="card-neon-sm">
                  <p className="text-xs text-muted">Partidas vencidas</p>
                  <p className="text-lg font-semibold">{teamSummary.matchesWon}</p>
                </article>
                <article className="card-neon-sm">
                  <p className="text-xs text-muted">Partidas empatadas</p>
                  <p className="text-lg font-semibold">{teamSummary.matchesDrawn}</p>
                </article>
                <article className="card-neon-sm">
                  <p className="text-xs text-muted">Partidas perdidas</p>
                  <p className="text-lg font-semibold">{teamSummary.matchesLost}</p>
                </article>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Top 3 artilheiros
                </p>
                {teamSummary.topScorers.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">Sem gols registrados para o time.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {teamSummary.topScorers.map((scorer, index) => (
                      <li key={`${scorer.player}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                        <span>{scorer.player}</span>
                        <strong>{scorer.goals} gols</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </details>
      ) : null}

      <details className="group mt-4 card-neon text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
          <span>Top 4 times do ano selecionado</span>
          <AccordionChevron />
        </summary>
        {loading ? (
          <p className="mt-2 text-sm text-muted">Carregando...</p>
        ) : topFourTeams.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sem classificação disponível para o ano.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {topFourTeams.map((team, index) => {
              const position = index + 1;
              const draws = Math.max(team.points - team.wins * 3, 0);
              const losses = Math.max(team.played - team.wins - draws, 0);

              return (
                <details
                  key={team.team}
                  className="group card-neon-sm"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {position}. {team.team}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">{getRankLabel(position)}</span>
                        <AccordionChevron />
                      </div>
                    </div>
                  </summary>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="card-neon-sm">
                      <p className="text-xs text-muted">Pontos</p>
                      <p className="font-semibold">{team.points}</p>
                    </div>
                    <div className="card-neon-sm">
                      <p className="text-xs text-muted">Jogos</p>
                      <p className="font-semibold">{team.played}</p>
                    </div>
                    <div className="card-neon-sm">
                      <p className="text-xs text-muted">Vitórias</p>
                      <p className="font-semibold">{team.wins}</p>
                    </div>
                    <div className="card-neon-sm">
                      <p className="text-xs text-muted">Empates</p>
                      <p className="font-semibold">{draws}</p>
                    </div>
                    <div className="card-neon-sm">
                      <p className="text-xs text-muted">Derrotas</p>
                      <p className="font-semibold">{losses}</p>
                    </div>
                    <div className="card-neon-sm">
                      <p className="text-xs text-muted">Saldo de gols</p>
                      <p className="font-semibold">{team.goalDiff}</p>
                    </div>
                    <div className="card-neon-sm">
                      <p className="text-xs text-muted">Gols marcados</p>
                      <p className="font-semibold">{team.goalsFor}</p>
                    </div>
                    <div className="card-neon-sm">
                      <p className="text-xs text-muted">Gols sofridos</p>
                      <p className="font-semibold">{team.goalsAgainst}</p>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </details>

      <details className="group mt-4 card-neon text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
          <span>Rodadas x Jogos</span>
          <AccordionChevron />
        </summary>

        {loading ? (
          <div className="mt-3 card-neon">Carregando...</div>
        ) : groupedByRound.length === 0 ? (
          <div className="mt-3 card-neon">
            Nenhuma partida encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="mt-3 max-h-[70vh] overflow-auto rounded-xl border border-black/10 dark:border-white/20">
            <table className="min-w-max text-sm">
              <thead className="sticky top-0 z-20 border-b border-black/10 bg-background dark:border-white/20">
                <tr>
                  <th className="sticky left-0 z-10 border-r border-black/10 bg-background px-3 py-2 text-left dark:border-white/20">
                    Rodada
                  </th>
                  {gameColumns.map((game) => (
                    <th key={game} className="min-w-52 px-3 py-2 text-left">
                      Jogo {game}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedByRound.map((group) => (
                  <tr key={`round-${group.round}`} className="border-t border-black/5 dark:border-white/10">
                    <td className="sticky left-0 z-10 border-r border-black/10 bg-background px-3 py-2 font-medium dark:border-white/20">
                      Rodada {group.round}
                    </td>
                    {gameColumns.map((gameIndex) => {
                      const match = group.matches[gameIndex - 1] ?? null;

                      return (
                        <td key={`${group.round}-${gameIndex}`} className="align-top px-3 py-2">
                        {match ? (
                          <div className="card-neon-sm text-sm">
                            <div className="font-semibold">
                              {match.mandante} {match.mandante_Placar}x{match.visitante_Placar} {match.visitante}
                            </div>
                            <div className="mt-1 text-muted">{match.data}</div>
                          </div>
                        ) : (
                          <span className="text-black/40 dark:text-white/40">—</span>
                        )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </>
  );
}

export default function ExploracaoPage() {
  return (
    <AppShell>
      <ExploracaoContent />
    </AppShell>
  );
}
