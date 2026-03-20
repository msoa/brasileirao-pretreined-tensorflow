import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mlPost } from "@/lib/server/ml-client";

const PredictSchema = z.object({
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = PredictSchema.parse(body);
    const result = await mlPost("/predict", payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao executar predição",
        detail: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
