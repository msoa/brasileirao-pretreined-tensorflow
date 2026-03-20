import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

type RawMatchRow = {
  ID: string;
  rodata: string;
  data: string;
  hora: string;
  mandante: string;
  visitante: string;
  vencedor: string;
  arena: string;
  mandante_Placar: string;
  visitante_Placar: string;
};

export type MatchRow = {
  id: string;
  round: string;
  matchDate: string;
  matchTime: string;
  homeTeam: string;
  awayTeam: string;
  winner: string;
  venue: string;
  homeScore: string;
  awayScore: string;
};

type RawGoalRow = {
  partida_id: string;
  rodata: string;
  clube: string;
  atleta: string;
  minuto: string;
  tipo_de_gol?: string;
};

type GoalRow = {
  matchId: string;
  round: string;
  team: string;
  player: string;
  minute: string;
  goalType?: string;
};

export type TeamSummary = {
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

export function getMatchYear(match: MatchRow): string {
  const rawDate = (match.matchDate ?? "").trim();
  const parts = rawDate.split("/");
  return parts[parts.length - 1] ?? "";
}

function resolveDataPath(fileName: string): string {
  return path.resolve(process.cwd(), "data", fileName);
}

async function loadCsvFile<T extends Record<string, string>>(fileName: string): Promise<T[]> {
  const filePath = resolveDataPath(fileName);
  const content = await readFile(filePath, "utf-8");

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    delimiter: ",",
  }) as T[];
}

export async function loadMatches(): Promise<MatchRow[]> {
  const rows = await loadCsvFile<RawMatchRow>("campeonato-brasileiro-full.csv");
  return rows.map((row) => ({
    id: row.ID,
    round: row.rodata,
    matchDate: row.data,
    matchTime: row.hora,
    homeTeam: row.mandante,
    awayTeam: row.visitante,
    winner: row.vencedor,
    venue: row.arena,
    homeScore: row.mandante_Placar,
    awayScore: row.visitante_Placar,
  }));
}

export async function loadStatsRows(): Promise<Array<Record<string, string>>> {
  return loadCsvFile<Record<string, string>>("campeonato-brasileiro-estatisticas-full.csv");
}

async function loadGoalsRows(): Promise<GoalRow[]> {
  const rows = await loadCsvFile<RawGoalRow>("campeonato-brasileiro-gols.csv");
  return rows.map((row) => ({
    matchId: row.partida_id,
    round: row.rodata,
    team: row.clube,
    player: row.atleta,
    minute: row.minuto,
    goalType: row.tipo_de_gol,
  }));
}

export async function getDataSummary() {
  const [matches, stats] = await Promise.all([loadMatches(), loadStatsRows()]);
  const teams = new Set<string>();

  for (const row of matches) {
    if (row.homeTeam) teams.add(row.homeTeam.trim());
    if (row.awayTeam) teams.add(row.awayTeam.trim());
  }

  return {
    totalMatches: matches.length,
    totalStatsRows: stats.length,
    totalTeams: teams.size,
    range: {
      minId: Number(matches[0]?.id ?? 0),
      maxId: Number(matches[matches.length - 1]?.id ?? 0),
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function getTeams() {
  const matches = await loadMatches();
  const teams = new Set<string>();

  for (const row of matches) {
    if (row.homeTeam) teams.add(row.homeTeam.trim());
    if (row.awayTeam) teams.add(row.awayTeam.trim());
  }

  return Array.from(teams).sort((left, right) => left.localeCompare(right));
}

export async function getAvailableYears() {
  const matches = await loadMatches();
  const years = new Set<string>();

  for (const match of matches) {
    const year = getMatchYear(match);
    if (year) {
      years.add(year);
    }
  }

  return Array.from(years).sort((left, right) => Number(right) - Number(left));
}

export async function getTeamsByYear(year: string) {
  const matches = await loadMatches();
  const teams = new Set<string>();

  for (const match of matches) {
    if (getMatchYear(match) !== year) {
      continue;
    }

    if (match.homeTeam) teams.add(match.homeTeam.trim());
    if (match.awayTeam) teams.add(match.awayTeam.trim());
  }

  return Array.from(teams).sort((left, right) => left.localeCompare(right));
}

export async function getFilteredMatches(options: {
  year: string;
  team?: string;
}) {
  const matches = await loadMatches();

  const filtered = matches.filter((match) => {
    const yearMatches = getMatchYear(match) === options.year;
    const teamMatches =
      !options.team || match.homeTeam === options.team || match.awayTeam === options.team;
    return yearMatches && teamMatches;
  });

  return filtered.sort((left, right) => {
    const leftRound = Number(left.round) || 0;
    const rightRound = Number(right.round) || 0;
    if (leftRound !== rightRound) {
      return leftRound - rightRound;
    }

    const leftId = Number(left.id) || 0;
    const rightId = Number(right.id) || 0;
    return leftId - rightId;
  });
}

export async function getTeamSummary(options: { year: string; team: string }): Promise<TeamSummary> {
  const [matches, goals] = await Promise.all([loadMatches(), loadGoalsRows()]);

  const yearMatches = matches.filter((match) => getMatchYear(match) === options.year);

  const teamMatches = yearMatches.filter(
    (match) => match.homeTeam === options.team || match.awayTeam === options.team,
  );

  const goalsFor = teamMatches.reduce((total, match) => {
    if (match.homeTeam === options.team) {
      return total + (Number(match.homeScore) || 0);
    }
    return total + (Number(match.awayScore) || 0);
  }, 0);

  const goalsAgainst = teamMatches.reduce((total, match) => {
    if (match.homeTeam === options.team) {
      return total + (Number(match.awayScore) || 0);
    }
    return total + (Number(match.homeScore) || 0);
  }, 0);

  const matchResults = teamMatches.reduce(
    (acc, match) => {
      const homeGoals = Number(match.homeScore) || 0;
      const awayGoals = Number(match.awayScore) || 0;

      if (homeGoals === awayGoals) {
        acc.matchesDrawn += 1;
        return acc;
      }

      const teamWonAsHome = match.homeTeam === options.team && homeGoals > awayGoals;
      const teamWonAsAway = match.awayTeam === options.team && awayGoals > homeGoals;

      if (teamWonAsHome || teamWonAsAway) {
        acc.matchesWon += 1;
      } else {
        acc.matchesLost += 1;
      }

      return acc;
    },
    {
      matchesWon: 0,
      matchesDrawn: 0,
      matchesLost: 0,
    },
  );

  const scorersMap = new Map<string, number>();

  for (const goal of goals) {
    const goalTeam = goal.team?.trim();
    const goalPlayer = goal.player?.trim();
    const goalType = goal.goalType?.trim().toLowerCase();

    if (!goalTeam || !goalPlayer) {
      continue;
    }

    if (goalTeam !== options.team) {
      continue;
    }

    if (goalType === "gol contra") {
      continue;
    }

    const match = yearMatches.find((item) => item.id === goal.matchId);
    if (!match) {
      continue;
    }

    scorersMap.set(goalPlayer, (scorersMap.get(goalPlayer) ?? 0) + 1);
  }

  const topScorers = Array.from(scorersMap.entries())
    .map(([player, goalsCount]) => ({ player, goals: goalsCount }))
    .sort((left, right) => {
      if (right.goals !== left.goals) return right.goals - left.goals;
      return left.player.localeCompare(right.player);
    })
    .slice(0, 3);

  return {
    goalsFor,
    goalsAgainst,
    matchesWon: matchResults.matchesWon,
    matchesDrawn: matchResults.matchesDrawn,
    matchesLost: matchResults.matchesLost,
    topScorers,
  };
}
