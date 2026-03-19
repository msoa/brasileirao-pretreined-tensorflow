import { NextRequest, NextResponse } from "next/server";
import { getFilteredMatches } from "@/lib/server/csv-data";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const year = url.searchParams.get("year") ?? undefined;
    const team = url.searchParams.get("team") ?? undefined;

    if (!year) {
      return NextResponse.json(
        {
          error: "Parâmetro obrigatório ausente",
          detail: "Informe o parâmetro year.",
        },
        { status: 400 },
      );
    }

    const matches = await getFilteredMatches({ year, team });
    return NextResponse.json({ matches, count: matches.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar partidas",
        detail: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
