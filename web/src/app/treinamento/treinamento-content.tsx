"use client";

import { FormEvent, ReactNode, createContext, useContext, useMemo, useState } from "react";

type TrainResult = {
  test_accuracy: number;
  teams: number;
  history?: {
    accuracy: number[];
    val_accuracy: number[];
    loss: number[];
    val_loss: number[];
  };
};

type TrainingHistory = {
  accuracy: number[];
  val_accuracy: number[];
  loss: number[];
  val_loss: number[];
};

type TrainingStatus = {
  in_progress: boolean;
  current_epoch: number;
  total_epochs: number;
  progress: number;
  history: TrainingHistory;
};

const EMPTY_HISTORY: TrainingHistory = {
  accuracy: [],
  val_accuracy: [],
  loss: [],
  val_loss: [],
};

type LineChartProps = {
  title: string;
  seriesA: number[];
  seriesALabel: string;
  seriesB: number[];
  seriesBLabel: string;
  formatter: (value: number) => string;
};

type TrainingContextValue = {
  epochs: number;
  setEpochs: (value: number) => void;
  batchSize: number;
  setBatchSize: (value: number) => void;
  testSize: number;
  setTestSize: (value: number) => void;
  trainingProgress: number;
  loading: boolean;
  result: TrainResult | null;
  liveStatus: TrainingStatus | null;
  error: string | null;
  onSubmit: (event: FormEvent) => Promise<void>;
  chartHistory: TrainingHistory;
};

const TrainingContext = createContext<TrainingContextValue | null>(null);

function useTrainingContext() {
  const context = useContext(TrainingContext);
  if (!context) {
    throw new Error("Treinamento components must be used within TreinamentoProvider");
  }
  return context;
}

function toPath(values: number[], min: number, max: number, width: number, height: number): string {
  if (values.length === 0) return "";
  const safeRange = max - min === 0 ? 1 : max - min;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / safeRange) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function TrainingLineChart(props: LineChartProps) {
  const { title, seriesA, seriesALabel, seriesB, seriesBLabel, formatter } = props;
  const values = [...seriesA, ...seriesB];

  if (values.length === 0) {
    return (
      <article className="card-neon">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="mt-2 text-sm text-muted">Sem dados de treino nesta sessão.</p>
      </article>
    );
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const totalEpochs = Math.max(seriesA.length, seriesB.length);

  const svgWidth = 520;
  const svgHeight = 220;
  const marginLeft = 52;
  const marginRight = 12;
  const marginTop = 10;
  const marginBottom = 34;
  const chartWidth = svgWidth - marginLeft - marginRight;
  const chartHeight = svgHeight - marginTop - marginBottom;

  const yTicks = [
    maxValue,
    minValue + (maxValue - minValue) * 0.75,
    minValue + (maxValue - minValue) * 0.5,
    minValue + (maxValue - minValue) * 0.25,
    minValue,
  ];

  const xTicks = totalEpochs <= 1 ? [1] : [1, Math.max(1, Math.round(totalEpochs / 2)), totalEpochs];

  const pathA = toPath(seriesA, minValue, maxValue, chartWidth, chartHeight);
  const pathB = toPath(seriesB, minValue, maxValue, chartWidth, chartHeight);

  return (
    <article className="card-neon">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-56 min-w-[520px] w-full"
          role="img"
          aria-label={title}
        >
          <g transform={`translate(${marginLeft}, ${marginTop})`}>
            <line
              x1="0"
              y1={chartHeight}
              x2={chartWidth}
              y2={chartHeight}
              style={{ stroke: "var(--border-subtle)" }}
            />
            <line x1="0" y1="0" x2="0" y2={chartHeight} style={{ stroke: "var(--border-subtle)" }} />
            {pathA ? <path d={pathA} className="fill-none stroke-[2] stroke-sky-600 dark:stroke-sky-400" /> : null}
            {pathB ? <path d={pathB} className="fill-none stroke-[2] stroke-amber-600 dark:stroke-amber-400" /> : null}
          </g>

          {yTicks.map((tickValue, index) => {
            const y = marginTop + (index / (yTicks.length - 1)) * chartHeight;
            return (
              <g key={`y-${index}`}>
                <line
                  x1={marginLeft}
                  y1={y}
                  x2={svgWidth - marginRight}
                  y2={y}
                  style={{ stroke: "var(--border-subtle)" }}
                />
                <text x={marginLeft - 8} y={y + 4} textAnchor="end" className="text-[10px]" style={{ fill: "var(--text-subtle)" }}>
                  {formatter(tickValue)}
                </text>
              </g>
            );
          })}

          {xTicks.map((tickEpoch, index) => {
            const x =
              totalEpochs <= 1
                ? marginLeft + chartWidth / 2
                : marginLeft + ((tickEpoch - 1) / (totalEpochs - 1)) * chartWidth;
            return (
              <g key={`x-${index}`}>
                <line
                  x1={x}
                  y1={marginTop + chartHeight}
                  x2={x}
                  y2={marginTop + chartHeight + 5}
                  style={{ stroke: "var(--border-subtle)" }}
                />
                <text
                  x={x}
                  y={marginTop + chartHeight + 18}
                  textAnchor="middle"
                  className="text-[10px]"
                  style={{ fill: "var(--text-subtle)" }}
                >
                  {`Época ${tickEpoch}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-600 dark:bg-sky-400" />
          {seriesALabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400" />
          {seriesBLabel}
        </span>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-2">
        <p>Início: {formatter(values[0])}</p>
        <p>Final: {formatter(values[values.length - 1])}</p>
      </div>
    </article>
  );
}

export function TreinamentoProvider({ children }: { children: ReactNode }) {
  const [epochs, setEpochs] = useState(80);
  const [batchSize, setBatchSize] = useState(32);
  const [testSize, setTestSize] = useState(0.2);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrainResult | null>(null);
  const [liveHistory, setLiveHistory] = useState<TrainingHistory>(EMPTY_HISTORY);
  const [liveStatus, setLiveStatus] = useState<TrainingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setLiveHistory(EMPTY_HISTORY);
    setLiveStatus(null);

    setTrainingProgress(0);
    const pollingInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/ml/train-status");
        if (!response.ok) return;

        const statusData: TrainingStatus = await response.json();
        setLiveStatus(statusData);
        setLiveHistory(statusData.history ?? EMPTY_HISTORY);
        setTrainingProgress(Math.max(0, Math.min(100, Number(statusData.progress) || 0)));
      } catch {
        return;
      }
    }, 600);

    try {
      const response = await fetch("/api/ml/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          epochs,
          batch_size: batchSize,
          test_size: testSize,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? "Falha ao treinar modelo");
      }

      setResult(data);
      if (data.history) {
        setLiveHistory(data.history);
      }
      setTrainingProgress(100);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro desconhecido");
      setTrainingProgress(0);
    } finally {
      clearInterval(pollingInterval);
      setLoading(false);
    }
  }

  const chartHistory = useMemo(() => {
    if (liveHistory.accuracy.length > 0 || liveHistory.loss.length > 0) {
      return liveHistory;
    }

    return result?.history ?? EMPTY_HISTORY;
  }, [liveHistory, result]);

  const value: TrainingContextValue = {
    epochs,
    setEpochs,
    batchSize,
    setBatchSize,
    testSize,
    setTestSize,
    trainingProgress,
    loading,
    result,
    liveStatus,
    error,
    onSubmit,
    chartHistory,
  };

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function TreinamentoContent() {
  const {
    epochs,
    setEpochs,
    batchSize,
    setBatchSize,
    testSize,
    setTestSize,
    trainingProgress,
    loading,
    result,
    liveStatus,
    error,
    onSubmit,
  } = useTrainingContext();

  return (
    <>
      <section className="card-neon">
        <h2 className="text-base font-semibold">Configuração do treino</h2>
        <div className="mt-3">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Épocas</span>
              <input
                type="number"
                min={10}
                max={400}
                value={epochs}
                onChange={(event) => setEpochs(Number(event.target.value))}
                className="w-full rounded-md border bg-transparent px-3 py-2"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Batch size</span>
              <input
                type="number"
                min={8}
                max={128}
                value={batchSize}
                onChange={(event) => setBatchSize(Number(event.target.value))}
                className="w-full rounded-md border bg-transparent px-3 py-2"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Teste (%)</span>
              <input
                type="number"
                step={0.05}
                min={0.1}
                max={0.4}
                value={testSize}
                onChange={(event) => setTestSize(Number(event.target.value))}
                className="w-full rounded-md border bg-transparent px-3 py-2"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            </label>
            <div className="sm:col-span-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? "Treinando..." : "Iniciar treinamento"}
                </button>

                <div className="min-w-[220px] flex-1">
                  <div
                    className="h-3 w-full overflow-hidden rounded-full border"
                    style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--card-background)" }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${trainingProgress}%`, backgroundColor: "var(--accent)" }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>
                      {loading
                        ? `Treinando${liveStatus ? ` (época ${liveStatus.current_epoch}/${liveStatus.total_epochs})` : ""}`
                        : "Aguardando novo treino"}
                    </span>
                    <strong className="text-foreground">{trainingProgress}%</strong>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section className="card-neon mt-4">
        <h3 className="text-base font-semibold">Resultado</h3>
        {error ? <p className="mt-2 text-sm">Erro: {error}</p> : null}
        {result ? (
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>Acurácia de teste: {(result.test_accuracy * 100).toFixed(2)}%</li>
            <li>Times usados: {result.teams}</li>
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nenhum treino executado nesta sessão.</p>
        )}
      </section>
    </>
  );
}

export function TreinamentoChartsContent({ className = "" }: { className?: string }) {
  const { chartHistory } = useTrainingContext();

  return (
    <section className={`card-neon ${className}`.trim()}>
      <h3 className="text-base font-semibold">Gráficos</h3>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TrainingLineChart
          title="Acurácia por época"
          seriesA={chartHistory.accuracy}
          seriesALabel="Treino"
          seriesB={chartHistory.val_accuracy}
          seriesBLabel="Validação"
          formatter={(value) => `${(value * 100).toFixed(2)}%`}
        />

        <TrainingLineChart
          title="Erro (loss) por época"
          seriesA={chartHistory.loss}
          seriesALabel="Treino"
          seriesB={chartHistory.val_loss}
          seriesBLabel="Validação"
          formatter={(value) => value.toFixed(4)}
        />
      </div>
    </section>
  );
}

export function TreinamentoAjudaContent({ className = "" }: { className?: string }) {
  return (
    <details className={`group card-neon ${className}`.trim()}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
        <span>Ajuda</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="accordion-arrow h-4 w-4 transition-transform group-open:rotate-180"
        >
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </summary>

      <div className="mt-3 space-y-4">
        <div>
          <h3 className="text-base font-semibold">Base de dados e modelo</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Partidas na base</p>
              <p className="mt-1 text-muted">
                Quantidade total de jogos disponíveis para treino e análise no dataset carregado.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Times únicos</p>
              <p className="mt-1 text-muted">
                Número de clubes distintos presentes no recorte de dados usado pelo sistema.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Modelo treinado</p>
              <p className="mt-1 text-muted">
                Indica se já existe um modelo pronto para inferência. &quot;Sim&quot; habilita previsões imediatas.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Acurácia teste</p>
              <p className="mt-1 text-muted">
                Medida do desempenho no conjunto de teste. Quanto maior, melhor a taxa de acerto observada.
              </p>
            </article>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold">Treinamento</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Configuração do treino</p>
              <p className="mt-1 text-muted">
                Define parâmetros do treinamento: épocas, batch size e percentual de teste.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Barra de progresso</p>
              <p className="mt-1 text-muted">
                Mostra andamento da execução e a época atual enquanto o treino está em processamento.
              </p>
            </article>
            <article className="card-neon-sm text-sm md:col-span-2">
              <p className="font-semibold">Resultado</p>
              <p className="mt-1 text-muted">
                Exibe os indicadores finais do treino da sessão: acurácia de teste e quantidade de times usados.
              </p>
            </article>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold">Previsões</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Predizer partida</p>
              <p className="mt-1 text-muted">
                Escolha de mandante e visitante para calcular o desfecho mais provável com o modelo atual.
              </p>
            </article>

            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Classe prevista</p>
              <p className="mt-1 text-muted">
                Resultado principal previsto pelo modelo: MANDANTE, EMPATE ou VISITANTE.
              </p>
            </article>

            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Probabilidades</p>
              <p className="mt-1 text-muted">
                Distribuição percentual em colunas para mandante, empate e visitante.
              </p>
            </article>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold">Gráficos</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Acurácia por época</p>
              <p className="mt-1 text-muted">
                Mostra evolução da acurácia em treino e validação ao longo das épocas. Quanto maior, melhor.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Erro (loss) por época</p>
              <p className="mt-1 text-muted">
                Mostra redução do erro durante o treino. Quanto menor, melhor, com curvas de treino e validação próximas.
              </p>
            </article>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold">Exploração</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Filtros</p>
              <p className="mt-1 text-muted">
                Permitem selecionar ano (obrigatório) e time (opcional) para consultar partidas e estatísticas.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Resumo geral</p>
              <p className="mt-1 text-muted">
                Consolida quantidade de partidas, rodadas e jogos decididos no recorte atual.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Top 4 e status do time</p>
              <p className="mt-1 text-muted">
                Exibe a classificação final dos quatro primeiros e o status do time filtrado no ano selecionado.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Rodadas x Jogos e detalhes</p>
              <p className="mt-1 text-muted">
                Organiza partidas por rodada e mostra placares, vencedores e informações de desempenho por time.
              </p>
            </article>
          </div>
        </div>
      </div>
    </details>
  );
}
