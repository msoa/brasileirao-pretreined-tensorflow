import { NextResponse } from "next/server";
import { mlGet } from "@/lib/server/ml-client";

export async function GET() {
  try {
    const info = await mlGet("/model/info");
    return NextResponse.json(info);
  } catch (error) {
    return NextResponse.json(
      {
        trained: false,
        version: "unavailable",
        test_accuracy: 0,
        teams: 0,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 503 },
    );
  }
}
