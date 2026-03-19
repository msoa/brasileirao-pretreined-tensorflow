import { NextRequest, NextResponse } from "next/server";
import { getTeams, getTeamsByYear } from "@/lib/server/csv-data";

export async function GET(request: NextRequest) {
  try {
    const year = request.nextUrl.searchParams.get("year");
    const teams = year ? await getTeamsByYear(year) : await getTeams();
    return NextResponse.json({ teams });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar lista de times",
        detail: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
