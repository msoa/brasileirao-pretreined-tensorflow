import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";
import { loadMatches } from "@/lib/server/csv-data";

type TrainPayload = {
  epochs: number;
  batch_size: number;
  test_size: number;
  learning_rate: number;
  hidden_layers: number[];
  dropout_rate: number;
  l2_lambda: number;
  optimizer: "adam" | "rmsprop";
  early_stopping_patience: number;
  early_stopping_min_delta: number;
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

type ModelMetadata = {
  teams: string[];
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
const FAST_MODE_MAX_EPOCHS = 40;
const ARTIFACTS_DIR = path.resolve(process.cwd(), ".artifacts");
const TFJS_MODEL_DIR = path.resolve(ARTIFACTS_DIR, "match-predictor-tfjs");
const MODEL_STATE_FILE = path.resolve(TFJS_MODEL_DIR, "model-state.json");

type PersistedModelState = {
  metadata: ModelMetadata;
  weightShapes: number[][];
  weightValues: number[][];
};

let modelState: ModelMetadata | null = null;
let tfModel: tf.LayersModel | null = null;
let modelLoaded = false;
let trainingStartedAtMs = 0;

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

type EncodedDataset = {
  xs: number[][];
  ys: number[][];
};

function resetTrainingStatus(totalEpochs: number): void {
  trainingStatus.in_progress = true;
  trainingStartedAtMs = Date.now();
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

function toNonNegativeMetric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAndValidateTrainPayload(payload: unknown): TrainPayload {
  const source = payload as Partial<TrainPayload>;
  const epochs = Math.trunc(toFiniteNumber(source?.epochs, 40));
  const batchSize = Math.trunc(toFiniteNumber(source?.batch_size, 32));
  const testSize = toFiniteNumber(source?.test_size, 0.2);
  const learningRate = toFiniteNumber(source?.learning_rate, 0.002);
  const dropoutRate = toFiniteNumber(source?.dropout_rate, 0.15);
  const l2Lambda = toFiniteNumber(source?.l2_lambda, 8e-5);
  const earlyStoppingPatience = Math.trunc(toFiniteNumber(source?.early_stopping_patience, 6));
  const earlyStoppingMinDelta = toFiniteNumber(source?.early_stopping_min_delta, 0.0005);

  const hiddenLayersSource = source?.hidden_layers;
  const hiddenLayers = Array.isArray(hiddenLayersSource)
    ? hiddenLayersSource.map((size) => Math.trunc(toFiniteNumber(size, 0))).filter((size) => size > 0)
    : [64, 32, 16];

  const optimizer = source?.optimizer === "rmsprop" ? "rmsprop" : "adam";

  if (epochs < 10 || epochs > 400) {
    throw new Error("Parâmetro epochs inválido. Use um valor entre 10 e 400.");
  }

  if (batchSize < 8 || batchSize > 128) {
    throw new Error("Parâmetro batch_size inválido. Use um valor entre 8 e 128.");
  }

  if (testSize < 0.1 || testSize > 0.4) {
    throw new Error("Parâmetro test_size inválido. Use um valor entre 0.1 e 0.4.");
  }

  if (learningRate < 0.0001 || learningRate > 0.02) {
    throw new Error("Parâmetro learning_rate inválido. Use um valor entre 0.0001 e 0.02.");
  }

  if (hiddenLayers.length < 2 || hiddenLayers.length > 4 || hiddenLayers.some((size) => size < 8 || size > 256)) {
    throw new Error("Parâmetro hidden_layers inválido. Use de 2 a 4 camadas, com valores entre 8 e 256.");
  }

  if (dropoutRate < 0 || dropoutRate > 0.5) {
    throw new Error("Parâmetro dropout_rate inválido. Use um valor entre 0 e 0.5.");
  }

  if (l2Lambda < 0 || l2Lambda > 0.01) {
    throw new Error("Parâmetro l2_lambda inválido. Use um valor entre 0 e 0.01.");
  }

  if (earlyStoppingPatience < 0 || earlyStoppingPatience > 20) {
    throw new Error("Parâmetro early_stopping_patience inválido. Use um valor entre 0 e 20.");
  }

  if (earlyStoppingMinDelta < 0 || earlyStoppingMinDelta > 0.01) {
    throw new Error("Parâmetro early_stopping_min_delta inválido. Use um valor entre 0 e 0.01.");
  }

  return {
    epochs,
    batch_size: batchSize,
    test_size: testSize,
    learning_rate: learningRate,
    hidden_layers: hiddenLayers,
    dropout_rate: dropoutRate,
    l2_lambda: l2Lambda,
    optimizer,
    early_stopping_patience: earlyStoppingPatience,
    early_stopping_min_delta: earlyStoppingMinDelta,
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

function encodeMatch(homeIndex: number, awayIndex: number, teamCount: number): number[] {
  const vector = new Array(teamCount * 2).fill(0);
  vector[homeIndex] = 1;
  vector[teamCount + awayIndex] = 1;
  return vector;
}

function oneHotLabel(target: number): number[] {
  return [target === 0 ? 1 : 0, target === 1 ? 1 : 0, target === 2 ? 1 : 0];
}

function toEncodedDataset(samples: EncodedSample[], teamCount: number): EncodedDataset {
  return {
    xs: samples.map((sample) => encodeMatch(sample.home, sample.away, teamCount)),
    ys: samples.map((sample) => oneHotLabel(sample.target)),
  };
}

function createOptimizer(name: TrainPayload["optimizer"], learningRate: number): tf.Optimizer {
  if (name === "rmsprop") {
    return tf.train.rmsprop(learningRate);
  }

  return tf.train.adam(learningRate);
}

function createModel(inputSize: number, params: TrainPayload): tf.LayersModel {
  const regularizer = tf.regularizers.l2({ l2: params.l2_lambda });
  const model = tf.sequential();
  const modelId = Date.now().toString(36);

  params.hidden_layers.forEach((units, index) => {
    model.add(
      tf.layers.dense({
        name: `dense_hidden_${index + 1}_${modelId}`,
        units,
        activation: "relu",
        kernelInitializer: "heNormal",
        kernelRegularizer: regularizer,
        ...(index === 0 ? { inputShape: [inputSize] } : {}),
      }),
    );

    if (params.dropout_rate > 0 && index < params.hidden_layers.length - 1) {
      model.add(tf.layers.dropout({ rate: params.dropout_rate, name: `dropout_${index + 1}_${modelId}` }));
    }
  });

  model.add(tf.layers.dense({ name: `dense_output_${modelId}`, units: 3, activation: "softmax" }));

  model.compile({
    optimizer: createOptimizer(params.optimizer, params.learning_rate),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  return model;
}

async function ensureModelLoaded(): Promise<void> {
  if (modelLoaded) {
    return;
  }

  modelLoaded = true;

  try {
    const hasState = await fileExists(MODEL_STATE_FILE);
    if (!hasState) {
      modelState = null;
      tfModel = null;
      return;
    }

    const rawState = await readFile(MODEL_STATE_FILE, "utf-8");
    const parsed = JSON.parse(rawState) as PersistedModelState;

    if (!parsed?.metadata || !Array.isArray(parsed.metadata.teams)) {
      throw new Error("Estado do modelo inválido.");
    }

    const inputSize = parsed.metadata.teams.length * 2;
    const loadedModel = createModel(inputSize, normalizeAndValidateTrainPayload({}));

    const tensors = parsed.weightValues.map((values, index) => {
      const shape = parsed.weightShapes[index];
      return tf.tensor(values, shape, "float32");
    });

    loadedModel.setWeights(tensors);
    tensors.forEach((tensor) => tensor.dispose());

    modelState = parsed.metadata;
    tfModel = loadedModel;
  } catch {
    modelState = null;
    tfModel = null;
  }
}

async function persistModel(state: ModelMetadata, model: tf.LayersModel): Promise<void> {
  await mkdir(TFJS_MODEL_DIR, { recursive: true });

  const weights = model.getWeights();
  const weightShapes = weights.map((tensor) => [...tensor.shape]);
  const weightValues = await Promise.all(
    weights.map(async (tensor) => {
      const data = await tensor.data();
      return Array.from(data);
    }),
  );

  const persisted: PersistedModelState = {
    metadata: state,
    weightShapes,
    weightValues,
  };

  await writeFile(MODEL_STATE_FILE, JSON.stringify(persisted), "utf-8");
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(() => resolve());
  });
}

export async function nodeTrainModel(payload: unknown): Promise<TrainResult> {
  await ensureModelLoaded();

  if (trainingStatus.in_progress) {
    const isStaleTraining =
      trainingStatus.current_epoch === 0 &&
      trainingStatus.history.accuracy.length === 0 &&
      Date.now() - trainingStartedAtMs > 30_000;

    if (isStaleTraining) {
      trainingStatus.in_progress = false;
      trainingStatus.progress = 0;
    }
  }

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

  const teams = Array.from(new Set(cleanedRows.flatMap((row) => [row.homeTeam, row.awayTeam]))).sort((left, right) =>
    left.localeCompare(right),
  );

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

  const trainDataset = toEncodedDataset(trainSamples, teamCount);
  const testDataset = toEncodedDataset(testSamples, teamCount);

  const effectiveEpochs = Math.min(params.epochs, FAST_MODE_MAX_EPOCHS);
  resetTrainingStatus(effectiveEpochs);

  let xsTrain: tf.Tensor2D | null = null;
  let ysTrain: tf.Tensor2D | null = null;
  let xsTest: tf.Tensor2D | null = null;
  let ysTest: tf.Tensor2D | null = null;
  let model: tf.LayersModel | null = null;

  try {
    xsTrain = tf.tensor2d(trainDataset.xs, [trainDataset.xs.length, featureCount], "float32");
    ysTrain = tf.tensor2d(trainDataset.ys, [trainDataset.ys.length, 3], "float32");
    xsTest = tf.tensor2d(testDataset.xs, [testDataset.xs.length, featureCount], "float32");
    ysTest = tf.tensor2d(testDataset.ys, [testDataset.ys.length, 3], "float32");

    if (tfModel) {
      tfModel.dispose();
      tfModel = null;
    }
    tf.disposeVariables();

    model = createModel(featureCount, params);
    let bestValLoss = Number.POSITIVE_INFINITY;
    let noImprovementEpochs = 0;

    await model.fit(xsTrain, ysTrain, {
      epochs: effectiveEpochs,
      batchSize: params.batch_size,
      validationData: [xsTest, ysTest],
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch: number, logs?: tf.Logs) => {
          const trainAccuracy = toNonNegativeMetric(logs?.acc ?? logs?.accuracy);
          const validAccuracy = toNonNegativeMetric(logs?.val_acc ?? logs?.val_accuracy);
          const trainLoss = toNonNegativeMetric(logs?.loss);
          const validLoss = toNonNegativeMetric(logs?.val_loss);

          trainingStatus.current_epoch = epoch + 1;
          trainingStatus.total_epochs = effectiveEpochs;
          trainingStatus.progress = Number((((epoch + 1) / effectiveEpochs) * 100).toFixed(2));
          trainingStatus.history.accuracy.push(trainAccuracy);
          trainingStatus.history.val_accuracy.push(validAccuracy);
          trainingStatus.history.loss.push(trainLoss);
          trainingStatus.history.val_loss.push(validLoss);

          if (params.early_stopping_patience > 0 && validLoss > 0) {
            if (validLoss < bestValLoss - params.early_stopping_min_delta) {
              bestValLoss = validLoss;
              noImprovementEpochs = 0;
            } else {
              noImprovementEpochs += 1;
              if (noImprovementEpochs >= params.early_stopping_patience) {
                const stoppableModel = model as tf.LayersModel & { stopTraining?: boolean };
                stoppableModel.stopTraining = true;
                trainingStatus.total_epochs = epoch + 1;
              }
            }
          }

          await yieldToEventLoop();
        },
      },
    });

    const finalTestAccuracy = trainingStatus.history.val_accuracy.at(-1) ?? 0;
    const version = new Date().toISOString();

    modelState = {
      teams,
      version,
      test_accuracy: finalTestAccuracy,
    };

    await persistModel(modelState, model);

    tfModel = model;

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
    model?.dispose();
    trainingStatus.in_progress = false;
    trainingStatus.progress = 0;
    throw error;
  } finally {
    xsTrain?.dispose();
    ysTrain?.dispose();
    xsTest?.dispose();
    ysTest?.dispose();
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

  if (!modelState || !tfModel) {
    throw new Error("Modelo não treinado. Execute /train primeiro.");
  }

  const params = normalizeAndValidatePredictPayload(payload);
  const teamToIndex = new Map<string, number>();
  modelState.teams.forEach((team, index) => teamToIndex.set(team, index));

  if (!teamToIndex.has(params.mandante) || !teamToIndex.has(params.visitante)) {
    throw new Error("Time não encontrado na base treinada.");
  }

  const homeIndex = teamToIndex.get(params.mandante) ?? 0;
  const awayIndex = teamToIndex.get(params.visitante) ?? 0;
  const encoded = encodeMatch(homeIndex, awayIndex, modelState.teams.length);

  const input = tf.tensor2d([encoded], [1, encoded.length], "float32");
  const output = tfModel.predict(input) as tf.Tensor;
  const probabilityData = await output.data();
  const probabilities = Array.from(probabilityData);

  input.dispose();
  output.dispose();

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