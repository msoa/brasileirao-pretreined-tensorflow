import { NextResponse } from "next/server";
import { getDataSummary } from "@/lib/server/csv-data";

export async function GET() {
  try {
    const summary = await getDataSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar resumo da base",
        detail: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
