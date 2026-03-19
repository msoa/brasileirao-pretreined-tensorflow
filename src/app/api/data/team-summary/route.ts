import { NextRequest, NextResponse } from "next/server";
import { getTeamSummary } from "@/lib/server/csv-data";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const year = url.searchParams.get("year") ?? undefined;
    const team = url.searchParams.get("team") ?? undefined;

    if (!year || !team) {
      return NextResponse.json(
        {
          error: "Parâmetros obrigatórios ausentes",
          detail: "Informe os parâmetros year e team.",
        },
        { status: 400 },
      );
    }

    const summary = await getTeamSummary({ year, team });
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar resumo do time",
        detail: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
