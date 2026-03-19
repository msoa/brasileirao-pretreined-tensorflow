import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMatches } from "@/lib/server/csv-data";

type TrainPayload = {
  epochs: number;
  batch_size: number;
  test_size: number;
};

type PredictPayload = {
  mandante: string;
  visitante: string;
};

export type TrainingHistory = {
  accuracy: number[];
  val_accuracy: number[];
  loss: number[];
  val_loss: number[];
};

type ModelState = {
  teams: string[];
  weights: number[][];
  bias: number[];
  version: string;
  test_accuracy: number;
};

export type TrainingStatus = {
  in_progress: boolean;
  current_epoch: number;
  total_epochs: number;
  progress: number;
  history: TrainingHistory;
};

export type ModelInfo = {
  trained: boolean;
  version: string;
  test_accuracy: number;
  teams: number;
};

export type TrainResult = {
  status: string;
  test_accuracy: number;
  version: string;
  teams: number;
  history: TrainingHistory;
};

export type PredictResult = {
  prediction: "MANDANTE" | "EMPATE" | "VISITANTE";
  probabilities: {
    MANDANTE: number;
    EMPATE: number;
    VISITANTE: number;
  };
  model_version: string;
};

const LABELS = ["MANDANTE", "EMPATE", "VISITANTE"] as const;
const ARTIFACTS_DIR = path.resolve(process.cwd(), ".artifacts");
const MODEL_FILE = path.resolve(ARTIFACTS_DIR, "match-predictor-node.json");

let modelState: ModelState | null = null;
let modelLoaded = false;

const trainingStatus: TrainingStatus = {
  in_progress: false,
  current_epoch: 0,
  total_epochs: 0,
  progress: 0,
  history: {
    accuracy: [],
    val_accuracy: [],
    loss: [],
    val_loss: [],
  },
};

type EncodedSample = {
  home: number;
  away: number;
  target: number;
};

function resetTrainingStatus(totalEpochs: number): void {
  trainingStatus.in_progress = true;
  trainingStatus.current_epoch = 0;
  trainingStatus.total_epochs = totalEpochs;
  trainingStatus.progress = 0;
  trainingStatus.history = {
    accuracy: [],
    val_accuracy: [],
    loss: [],
    val_loss: [],
  };
}

function stableSoftmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const expValues = logits.map((value) => Math.exp(value - maxLogit));
  const sumExp = expValues.reduce((acc, value) => acc + value, 0);
  return expValues.map((value) => value / Math.max(sumExp, Number.EPSILON));
}

function argMax(values: number[]): number {
  let bestIndex = 0;
  let bestValue = values[0] ?? Number.NEGATIVE_INFINITY;

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > bestValue) {
      bestValue = values[index];
      bestIndex = index;
    }
  }

  return bestIndex;
}

function computeMetrics(
  samples: EncodedSample[],
  weights: number[][],
  bias: number[],
  teamCount: number,
) {
  if (samples.length === 0) {
    return {
      accuracy: 0,
      loss: 0,
    };
  }

  let correct = 0;
  let lossSum = 0;

  for (const sample of samples) {
    const awayOffset = teamCount + sample.away;
    const logits = [0, 1, 2].map((classIndex) => {
      return bias[classIndex] + weights[sample.home][classIndex] + weights[awayOffset][classIndex];
    });

    const probs = stableSoftmax(logits);
    const predicted = argMax(probs);
    if (predicted === sample.target) {
      correct += 1;
    }

    const targetProb = Math.max(probs[sample.target], 1e-12);
    lossSum += -Math.log(targetProb);
  }

  return {
    accuracy: correct / samples.length,
    loss: lossSum / samples.length,
  };
}

async function ensureModelLoaded(): Promise<void> {
  if (modelLoaded) {
    return;
  }

  modelLoaded = true;

  try {
    const raw = await readFile(MODEL_FILE, "utf-8");
    const parsed = JSON.parse(raw) as ModelState;

    if (
      Array.isArray(parsed.teams) &&
      Array.isArray(parsed.weights) &&
      Array.isArray(parsed.bias) &&
      typeof parsed.version === "string"
    ) {
      modelState = parsed;
    }
  } catch {
    modelState = null;
  }
}

async function persistModel(state: ModelState): Promise<void> {
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  await writeFile(MODEL_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAndValidateTrainPayload(payload: unknown): TrainPayload {
  const source = payload as Partial<TrainPayload>;
  const epochs = Math.trunc(toFiniteNumber(source?.epochs, 80));
  const batchSize = Math.trunc(toFiniteNumber(source?.batch_size, 32));
  const testSize = toFiniteNumber(source?.test_size, 0.2);

  if (epochs < 10 || epochs > 400) {
    throw new Error("Parâmetro epochs inválido. Use um valor entre 10 e 400.");
  }

  if (batchSize < 8 || batchSize > 128) {
    throw new Error("Parâmetro batch_size inválido. Use um valor entre 8 e 128.");
  }

  if (testSize < 0.1 || testSize > 0.4) {
    throw new Error("Parâmetro test_size inválido. Use um valor entre 0.1 e 0.4.");
  }

  return {
    epochs,
    batch_size: batchSize,
    test_size: testSize,
  };
}

function normalizeAndValidatePredictPayload(payload: unknown): PredictPayload {
  const source = payload as Partial<PredictPayload>;
  const mandante = `${source?.mandante ?? ""}`.trim();
  const visitante = `${source?.visitante ?? ""}`.trim();

  if (!mandante || !visitante) {
    throw new Error("Parâmetros mandante e visitante são obrigatórios.");
  }

  return {
    mandante,
    visitante,
  };
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(() => resolve());
  });
}

export async function nodeTrainModel(payload: unknown): Promise<TrainResult> {
  await ensureModelLoaded();

  if (trainingStatus.in_progress) {
    throw new Error("Já existe um treinamento em andamento.");
  }

  const params = normalizeAndValidateTrainPayload(payload);
  const rows = await loadMatches();

  const cleanedRows = rows
    .map((row) => {
      const homeTeam = row.mandante?.trim();
      const awayTeam = row.visitante?.trim();
      const homeGoals = Number(row.mandante_Placar);
      const awayGoals = Number(row.visitante_Placar);

      if (!homeTeam || !awayTeam || !Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) {
        return null;
      }

      const target = homeGoals > awayGoals ? 0 : homeGoals === awayGoals ? 1 : 2;
      return {
        homeTeam,
        awayTeam,
        target,
      };
    })
    .filter((row): row is { homeTeam: string; awayTeam: string; target: number } => row !== null);

  const teams = Array.from(
    new Set(cleanedRows.flatMap((row) => [row.homeTeam, row.awayTeam])),
  ).sort((left, right) => left.localeCompare(right));

  if (teams.length === 0 || cleanedRows.length < 4) {
    throw new Error("Base insuficiente para treinamento.");
  }

  const teamToIndex = new Map<string, number>();
  teams.forEach((team, index) => teamToIndex.set(team, index));

  const encoded: EncodedSample[] = cleanedRows.map((row) => {
    return {
      home: teamToIndex.get(row.homeTeam) ?? 0,
      away: teamToIndex.get(row.awayTeam) ?? 0,
      target: row.target,
    };
  });

  const totalRows = encoded.length;
  const testCount = Math.max(1, Math.round(totalRows * params.test_size));
  const trainCount = Math.max(1, totalRows - testCount);

  if (trainCount < 1 || totalRows - trainCount < 1) {
    throw new Error("Não foi possível separar base de treino/teste com os parâmetros informados.");
  }

  const trainSamples = encoded.slice(0, trainCount);
  const testSamples = encoded.slice(trainCount);

  const teamCount = teams.length;
  const featureCount = teamCount * 2;
  const classCount = 3;

  const weights = Array.from({ length: featureCount }, () => {
    return Array.from({ length: classCount }, () => (Math.random() - 0.5) * 0.01);
  });
  const bias = [0, 0, 0];

  resetTrainingStatus(params.epochs);
  const baseLearningRate = 0.08;

  try {
    for (let epoch = 1; epoch <= params.epochs; epoch += 1) {
      const learningRate = baseLearningRate / (1 + epoch * 0.015);

      for (let batchStart = 0; batchStart < trainSamples.length; batchStart += params.batch_size) {
        const batch = trainSamples.slice(batchStart, batchStart + params.batch_size);
        const gradBias = [0, 0, 0];
        const gradWeights = new Map<number, number[]>();

        for (const sample of batch) {
          const homeIndex = sample.home;
          const awayIndex = teamCount + sample.away;

          const logits = [0, 1, 2].map((classIndex) => {
            return bias[classIndex] + weights[homeIndex][classIndex] + weights[awayIndex][classIndex];
          });

          const probs = stableSoftmax(logits);

          for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
            const error = probs[classIndex] - (sample.target === classIndex ? 1 : 0);
            gradBias[classIndex] += error;

            const homeGrad = gradWeights.get(homeIndex) ?? [0, 0, 0];
            homeGrad[classIndex] += error;
            gradWeights.set(homeIndex, homeGrad);

            const awayGrad = gradWeights.get(awayIndex) ?? [0, 0, 0];
            awayGrad[classIndex] += error;
            gradWeights.set(awayIndex, awayGrad);
          }
        }

        const batchSize = Math.max(batch.length, 1);
        for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
          bias[classIndex] -= (learningRate * gradBias[classIndex]) / batchSize;
        }

        for (const [featureIndex, featureGrad] of gradWeights.entries()) {
          for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
            weights[featureIndex][classIndex] -= (learningRate * featureGrad[classIndex]) / batchSize;
          }
        }
      }

      const trainMetrics = computeMetrics(trainSamples, weights, bias, teamCount);
      const testMetrics = computeMetrics(testSamples, weights, bias, teamCount);

      trainingStatus.current_epoch = epoch;
      trainingStatus.total_epochs = params.epochs;
      trainingStatus.progress = Number(((epoch / params.epochs) * 100).toFixed(2));
      trainingStatus.history.accuracy.push(trainMetrics.accuracy);
      trainingStatus.history.val_accuracy.push(testMetrics.accuracy);
      trainingStatus.history.loss.push(trainMetrics.loss);
      trainingStatus.history.val_loss.push(testMetrics.loss);

      await yieldToEventLoop();
    }

    const finalTestAccuracy = trainingStatus.history.val_accuracy.at(-1) ?? 0;
    const version = new Date().toISOString();

    modelState = {
      teams,
      weights,
      bias,
      version,
      test_accuracy: finalTestAccuracy,
    };

    await persistModel(modelState);

    trainingStatus.in_progress = false;
    trainingStatus.progress = 100;

    return {
      status: "trained",
      test_accuracy: finalTestAccuracy,
      version,
      teams: teams.length,
      history: trainingStatus.history,
    };
  } catch (error) {
    trainingStatus.in_progress = false;
    throw error;
  }
}

export async function nodeGetTrainStatus(): Promise<TrainingStatus> {
  return trainingStatus;
}

export async function nodeGetModelInfo(): Promise<ModelInfo> {
  await ensureModelLoaded();

  if (!modelState) {
    return {
      trained: false,
      version: "none",
      test_accuracy: 0,
      teams: 0,
    };
  }

  return {
    trained: true,
    version: modelState.version,
    test_accuracy: modelState.test_accuracy,
    teams: modelState.teams.length,
  };
}

export async function nodePredict(payload: unknown): Promise<PredictResult> {
  await ensureModelLoaded();

  if (!modelState) {
    throw new Error("Modelo não treinado. Execute /train primeiro.");
  }

  const params = normalizeAndValidatePredictPayload(payload);
  const teamToIndex = new Map<string, number>();
  modelState.teams.forEach((team, index) => teamToIndex.set(team, index));

  if (!teamToIndex.has(params.mandante) || !teamToIndex.has(params.visitante)) {
    throw new Error("Time não encontrado na base treinada.");
  }

  const homeIndex = teamToIndex.get(params.mandante) ?? 0;
  const awayIndex = modelState.teams.length + (teamToIndex.get(params.visitante) ?? 0);

  const logits = [0, 1, 2].map((classIndex) => {
    return (
      modelState!.bias[classIndex] +
      modelState!.weights[homeIndex][classIndex] +
      modelState!.weights[awayIndex][classIndex]
    );
  });
  const probabilities = stableSoftmax(logits);
  const topIndex = argMax(probabilities);

  return {
    prediction: LABELS[topIndex],
    probabilities: {
      MANDANTE: probabilities[0],
      EMPATE: probabilities[1],
      VISITANTE: probabilities[2],
    },
    model_version: modelState.version,
  };
}