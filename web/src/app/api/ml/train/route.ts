import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mlPost } from "@/lib/server/ml-client";

const TrainSchema = z.object({
  epochs: z.number().int().min(10).max(400).default(80),
  batch_size: z.number().int().min(8).max(128).default(32),
  test_size: z.number().min(0.1).max(0.4).default(0.2),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = TrainSchema.parse(body);
    const result = await mlPost("/train", payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao iniciar treinamento",
        detail: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
