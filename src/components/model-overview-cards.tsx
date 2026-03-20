"use client";

import { useCallback, useEffect, useState } from "react";

type SummaryInfo = {
  totalMatches?: number;
  totalTeams?: number;
};

type ModelInfo = {
  trained: boolean;
  test_accuracy: number;
};

type ModelOverviewCardsProps = {
  summary: SummaryInfo | null;
  initialModel: ModelInfo | null;
};

export function ModelOverviewCards({ summary, initialModel }: ModelOverviewCardsProps) {
  const [model, setModel] = useState<ModelInfo | null>(initialModel);

  const refreshModelInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/ml/model-info", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const modelInfo = (await response.json()) as ModelInfo;
      setModel(modelInfo);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    const pollingId = setInterval(refreshModelInfo, 2000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshModelInfo();
      }
    };

    const onModelUpdated = () => {
      void refreshModelInfo();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("ml:model-updated", onModelUpdated);

    return () => {
      clearInterval(pollingId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("ml:model-updated", onModelUpdated);
    };
  }, [refreshModelInfo]);

  return (
    <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article className="card-neon">
        <p className="text-muted">Partidas na base</p>
        <p className="text-2xl font-semibold">{summary?.totalMatches ?? "-"}</p>
      </article>
      <article className="card-neon">
        <p className="text-muted">Times únicos</p>
        <p className="text-2xl font-semibold">{summary?.totalTeams ?? "-"}</p>
      </article>
      <article className="card-neon">
        <p className="text-muted">Modelo treinado</p>
        <p className="text-2xl font-semibold">{model?.trained ? "Sim" : "Não"}</p>
      </article>
      <article className="card-neon">
        <p className="text-muted">Acurácia teste</p>
        <p className="text-2xl font-semibold">
          {typeof model?.test_accuracy === "number" ? `${(model.test_accuracy * 100).toFixed(1)}%` : "-"}
        </p>
      </article>
    </section>
  );
}
