import { NextResponse } from "next/server";
import { getAvailableYears } from "@/lib/server/csv-data";

export async function GET() {
  try {
    const years = await getAvailableYears();
    return NextResponse.json({ years });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar anos",
        detail: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
