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

type TrainingPreset = "fast" | "balanced" | "accuracy";

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
  preset: TrainingPreset;
  setPreset: (value: TrainingPreset) => void;
  epochs: number;
  setEpochs: (value: number) => void;
  batchSize: number;
  setBatchSize: (value: number) => void;
  testSize: number;
  setTestSize: (value: number) => void;
  learningRate: number;
  setLearningRate: (value: number) => void;
  layer1: number;
  setLayer1: (value: number) => void;
  layer2: number;
  setLayer2: (value: number) => void;
  layer3: number;
  setLayer3: (value: number) => void;
  dropoutRate: number;
  setDropoutRate: (value: number) => void;
  l2Lambda: number;
  setL2Lambda: (value: number) => void;
  optimizer: "adam" | "rmsprop";
  setOptimizer: (value: "adam" | "rmsprop") => void;
  earlyStoppingPatience: number;
  setEarlyStoppingPatience: (value: number) => void;
  earlyStoppingMinDelta: number;
  setEarlyStoppingMinDelta: (value: number) => void;
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
    throw new Error("Training components must be used within TrainingProvider");
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

function AccordionChevron({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={`accordion-arrow h-4 w-4 transition-transform ${className}`.trim()}
    >
      <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<TrainingPreset>("balanced");
  const [epochs, setEpochs] = useState(40);
  const [batchSize, setBatchSize] = useState(32);
  const [testSize, setTestSize] = useState(0.2);
  const [learningRate, setLearningRate] = useState(0.002);
  const [layer1, setLayer1] = useState(64);
  const [layer2, setLayer2] = useState(32);
  const [layer3, setLayer3] = useState(16);
  const [dropoutRate, setDropoutRate] = useState(0.15);
  const [l2Lambda, setL2Lambda] = useState(0.00008);
  const [optimizer, setOptimizer] = useState<"adam" | "rmsprop">("adam");
  const [earlyStoppingPatience, setEarlyStoppingPatience] = useState(6);
  const [earlyStoppingMinDelta, setEarlyStoppingMinDelta] = useState(0.0005);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrainResult | null>(null);
  const [liveHistory, setLiveHistory] = useState<TrainingHistory>(EMPTY_HISTORY);
  const [liveStatus, setLiveStatus] = useState<TrainingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(nextPreset: TrainingPreset) {
    setPreset(nextPreset);

    if (nextPreset === "fast") {
      setEpochs(30);
      setBatchSize(48);
      setTestSize(0.2);
      setLearningRate(0.003);
      setLayer1(48);
      setLayer2(24);
      setLayer3(12);
      setDropoutRate(0.1);
      setL2Lambda(0.00005);
      setOptimizer("adam");
      setEarlyStoppingPatience(4);
      setEarlyStoppingMinDelta(0.001);
      return;
    }

    if (nextPreset === "accuracy") {
      setEpochs(60);
      setBatchSize(24);
      setTestSize(0.2);
      setLearningRate(0.0015);
      setLayer1(96);
      setLayer2(48);
      setLayer3(24);
      setDropoutRate(0.2);
      setL2Lambda(0.00012);
      setOptimizer("adam");
      setEarlyStoppingPatience(8);
      setEarlyStoppingMinDelta(0.0003);
      return;
    }

    setEpochs(40);
    setBatchSize(32);
    setTestSize(0.2);
    setLearningRate(0.002);
    setLayer1(64);
    setLayer2(32);
    setLayer3(16);
    setDropoutRate(0.15);
    setL2Lambda(0.00008);
    setOptimizer("adam");
    setEarlyStoppingPatience(6);
    setEarlyStoppingMinDelta(0.0005);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setLiveHistory(EMPTY_HISTORY);
    setLiveStatus(null);

    const fetchTrainStatus = async () => {
      try {
        const response = await fetch("/api/ml/train-status");
        if (!response.ok) {
          return;
        }

        const statusData: TrainingStatus = await response.json();
        setLiveStatus(statusData);
        setLiveHistory(statusData.history ?? EMPTY_HISTORY);
        setTrainingProgress(Math.max(0, Math.min(100, Number(statusData.progress) || 0)));
      } catch {
        return;
      }
    };

    setTrainingProgress(0);
    await fetchTrainStatus();
    const pollingInterval = setInterval(fetchTrainStatus, 200);

    try {
      const response = await fetch("/api/ml/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          epochs,
          batch_size: batchSize,
          test_size: testSize,
          learning_rate: learningRate,
          hidden_layers: [layer1, layer2, layer3],
          dropout_rate: dropoutRate,
          l2_lambda: l2Lambda,
          optimizer,
          early_stopping_patience: earlyStoppingPatience,
          early_stopping_min_delta: earlyStoppingMinDelta,
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
      await fetchTrainStatus();
      setTrainingProgress((current) => Math.max(current, 100));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("ml:model-updated"));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro desconhecido");
      setTrainingProgress(0);
    } finally {
      clearInterval(pollingInterval);
      await fetchTrainStatus();
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
    preset,
    setPreset: applyPreset,
    epochs,
    setEpochs,
    batchSize,
    setBatchSize,
    testSize,
    setTestSize,
    learningRate,
    setLearningRate,
    layer1,
    setLayer1,
    layer2,
    setLayer2,
    layer3,
    setLayer3,
    dropoutRate,
    setDropoutRate,
    l2Lambda,
    setL2Lambda,
    optimizer,
    setOptimizer,
    earlyStoppingPatience,
    setEarlyStoppingPatience,
    earlyStoppingMinDelta,
    setEarlyStoppingMinDelta,
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

export function TrainingContent() {
  const {
    preset,
    setPreset,
    epochs,
    setEpochs,
    batchSize,
    setBatchSize,
    testSize,
    setTestSize,
    learningRate,
    setLearningRate,
    layer1,
    setLayer1,
    layer2,
    setLayer2,
    layer3,
    setLayer3,
    dropoutRate,
    setDropoutRate,
    l2Lambda,
    setL2Lambda,
    optimizer,
    setOptimizer,
    earlyStoppingPatience,
    setEarlyStoppingPatience,
    earlyStoppingMinDelta,
    setEarlyStoppingMinDelta,
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
            <label className="text-sm sm:col-span-3">
              <span className="mb-1 block text-muted">Preset</span>
              <select
                value={preset}
                onChange={(event) => setPreset(event.target.value as TrainingPreset)}
                className="select-neon w-full"
              >
                <option value="fast">Rápido</option>
                <option value="balanced">Balanceado</option>
                <option value="accuracy">Melhor acurácia</option>
              </select>
            </label>
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

            <details className="group/advanced sm:col-span-3 rounded-md border p-3" style={{ borderColor: "var(--border-subtle)" }}>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                <AccordionChevron className="group-open/advanced:rotate-90" />
                <span>Parâmetros avançados</span>
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Learning rate</span>
                  <input
                    type="number"
                    step={0.0001}
                    min={0.0001}
                    max={0.02}
                    value={learningRate}
                    onChange={(event) => setLearningRate(Number(event.target.value))}
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Otimizador</span>
                  <select
                    value={optimizer}
                    onChange={(event) => setOptimizer(event.target.value as "adam" | "rmsprop")}
                    className="select-neon w-full"
                  >
                    <option value="adam">Adam</option>
                    <option value="rmsprop">RMSprop</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Dropout</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={0.5}
                    value={dropoutRate}
                    onChange={(event) => setDropoutRate(Number(event.target.value))}
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">L2</span>
                  <input
                    type="number"
                    step={0.00001}
                    min={0}
                    max={0.01}
                    value={l2Lambda}
                    onChange={(event) => setL2Lambda(Number(event.target.value))}
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Camada 1 (neurônios)</span>
                  <input
                    type="number"
                    min={8}
                    max={256}
                    value={layer1}
                    onChange={(event) => setLayer1(Number(event.target.value))}
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Camada 2 (neurônios)</span>
                  <input
                    type="number"
                    min={8}
                    max={256}
                    value={layer2}
                    onChange={(event) => setLayer2(Number(event.target.value))}
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Camada 3 (neurônios)</span>
                  <input
                    type="number"
                    min={8}
                    max={256}
                    value={layer3}
                    onChange={(event) => setLayer3(Number(event.target.value))}
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Early stopping (paciência)</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={earlyStoppingPatience}
                    onChange={(event) => setEarlyStoppingPatience(Number(event.target.value))}
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Early stopping (min delta)</span>
                  <input
                    type="number"
                    step={0.0001}
                    min={0}
                    max={0.01}
                    value={earlyStoppingMinDelta}
                    onChange={(event) => setEarlyStoppingMinDelta(Number(event.target.value))}
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                    style={{ borderColor: "var(--border-subtle)" }}
                  />
                </label>
              </div>
            </details>

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
                        : trainingProgress >= 100
                          ? "Treinamento concluído"
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

export function TrainingChartsContent({ className = "" }: { className?: string }) {
  const { chartHistory } = useTrainingContext();

  return (
    <details className={`group/charts card-neon ${className}`.trim()}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <AccordionChevron className="group-open/charts:rotate-90" />
        <span>Gráficos</span>
      </summary>

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
    </details>
  );
}

function AjudaAccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group/subsection rounded-md border p-3" style={{ borderColor: "var(--border-subtle)" }}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <AccordionChevron className="group-open/subsection:rotate-90" />
        <span>{title}</span>
      </summary>

      <div className="mt-3">{children}</div>
    </details>
  );
}

export function TrainingHelpContent({ className = "" }: { className?: string }) {
  return (
    <details open className={`group/help card-neon ${className}`.trim()}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <AccordionChevron className="group-open/help:rotate-90" />
        <span>Ajuda</span>
      </summary>

      <div className="mt-3 space-y-4">
        <p className="text-sm text-muted">Fluxo rápido: ajuste, treine, observe e preveja.</p>
        <AjudaAccordionSection title="Ajuda geral" defaultOpen>
          <div className="grid gap-3 sm:grid-cols-2">
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
        </AjudaAccordionSection>

        <AjudaAccordionSection title="Treinamento">
          <div className="grid gap-3 md:grid-cols-2">
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Preset</p>
              <p className="mt-1 text-muted">
                Perfil pronto que preenche os campos automaticamente: rápido, balanceado ou foco em acurácia.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Épocas</p>
              <p className="mt-1 text-muted">
                Número máximo de ciclos de aprendizado sobre os dados de treino.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Batch size</p>
              <p className="mt-1 text-muted">
                Quantidade de amostras usadas por atualização de pesos; maior tende a treinar mais rápido e suavizar ruído.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Teste (%)</p>
              <p className="mt-1 text-muted">
                Fração reservada para validação final do modelo fora do conjunto de treino.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Learning rate</p>
              <p className="mt-1 text-muted">
                Tamanho do passo de ajuste dos pesos a cada atualização.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Otimizador</p>
              <p className="mt-1 text-muted">
                Algoritmo de atualização dos pesos (Adam ou RMSprop).
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Dropout</p>
              <p className="mt-1 text-muted">
                Desativa parte dos neurônios durante o treino para reduzir overfitting.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">L2</p>
              <p className="mt-1 text-muted">
                Penalização de pesos altos para melhorar generalização.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Camada 1 (neurônios)</p>
              <p className="mt-1 text-muted">
                Largura da primeira camada oculta da rede neural.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Camada 2 (neurônios)</p>
              <p className="mt-1 text-muted">
                Largura da segunda camada oculta; ajuda a refinar padrões intermediários.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Camada 3 (neurônios)</p>
              <p className="mt-1 text-muted">
                Largura da terceira camada oculta para detalhamento final antes da saída.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Early stopping (paciência)</p>
              <p className="mt-1 text-muted">
                Quantidade de épocas sem melhora antes de interromper o treino.
              </p>
            </article>
            <article className="card-neon-sm text-sm">
              <p className="font-semibold">Early stopping (min delta)</p>
              <p className="mt-1 text-muted">
                Melhora mínima exigida na loss de validação para considerar avanço real.
              </p>
            </article>
            <article className="card-neon-sm text-sm md:col-span-2">
              <p className="font-semibold">Barra de progresso e resultado</p>
              <p className="mt-1 text-muted">
                Acompanham época atual e progresso em tempo real, com acurácia final e times usados ao terminar.
              </p>
            </article>
          </div>
        </AjudaAccordionSection>

        <AjudaAccordionSection title="Previsões">
          <div className="grid gap-3 md:grid-cols-3">
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
        </AjudaAccordionSection>

        <AjudaAccordionSection title="Gráficos">
          <div className="grid gap-3 sm:grid-cols-2">
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
        </AjudaAccordionSection>

        <AjudaAccordionSection title="Exploração">
          <div className="grid gap-3 md:grid-cols-2">
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
        </AjudaAccordionSection>
      </div>
    </details>
  );
}
