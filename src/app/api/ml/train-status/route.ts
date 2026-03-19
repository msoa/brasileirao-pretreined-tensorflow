import { NextResponse } from "next/server";
import { mlGet } from "@/lib/server/ml-client";

export async function GET() {
  try {
    const data = await mlGet("/train/status");
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao consultar status do treinamento",
        detail: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
