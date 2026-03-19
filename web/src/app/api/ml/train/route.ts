import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mlPost } from "@/lib/server/ml-client";

const TrainSchema = z.object({
  epochs: z.number().int().min(10).max(400).default(40),
  batch_size: z.number().int().min(8).max(128).default(32),
  test_size: z.number().min(0.1).max(0.4).default(0.2),
  learning_rate: z.number().min(0.0001).max(0.02).default(0.002),
  hidden_layers: z.array(z.number().int().min(8).max(256)).min(2).max(4).default([64, 32, 16]),
  dropout_rate: z.number().min(0).max(0.5).default(0.15),
  l2_lambda: z.number().min(0).max(0.01).default(0.00008),
  optimizer: z.enum(["adam", "rmsprop"]).default("adam"),
  early_stopping_patience: z.number().int().min(0).max(20).default(6),
  early_stopping_min_delta: z.number().min(0).max(0.01).default(0.0005),
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
