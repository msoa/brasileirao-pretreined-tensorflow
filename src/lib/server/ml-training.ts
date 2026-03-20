import * as tf from "@tensorflow/tfjs";
import { loadMatches } from "@/lib/server/csv-data";
import {
  createEmptyTrainingHistory,
  FAST_MODE_MAX_EPOCHS,
  MODEL_STATE_FILE,
  PREDICTION_LABELS,
  type EncodedDataset,
  type EncodedSample,
  type ModelInfo,
  type ModelMetadata,
  type PersistedModelState,
  type PredictData,
  type PredictResult,
  type TrainParameters,
  type TrainResult,
  type TrainingStatus,
} from "@/lib/server/ml-model";
import { loadPersistedModelState, persistModelState } from "@/lib/server/ml-storage";

export type {
  ModelInfo,
  PredictResult,
  TrainResult,
  TrainingStatus,
} from "@/lib/server/ml-model";

let modelState: ModelMetadata | null = null;
let tfModel: tf.LayersModel | null = null;
let modelLoaded = false;
let trainingStartedAtMs = 0;

const trainingStatus: TrainingStatus = {
  in_progress: false,
  current_epoch: 0,
  total_epochs: 0,
  progress: 0,
  history: createEmptyTrainingHistory(),
};

function resetTrainingStatus(totalEpochs: number): void {
  trainingStatus.in_progress = true;
  trainingStartedAtMs = Date.now();
  trainingStatus.current_epoch = 0;
  trainingStatus.total_epochs = totalEpochs;
  trainingStatus.progress = 0;
  trainingStatus.history = createEmptyTrainingHistory();
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

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAndValidateTrainParameters(payload: unknown): TrainParameters {
  const source = payload as Partial<TrainParameters>;
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

function normalizeAndValidatePredictData(payload: unknown): PredictData {
  const source = payload as Partial<PredictData>;
  const homeTeam = `${source?.homeTeam ?? ""}`.trim();
  const awayTeam = `${source?.awayTeam ?? ""}`.trim();

  if (!homeTeam || !awayTeam) {
    throw new Error("Parâmetros homeTeam e awayTeam são obrigatórios.");
  }

  return {
    homeTeam,
    awayTeam,
  };
}

function createMatchFeatureVector(homeIndex: number, awayIndex: number, teamCount: number): number[] {
  const vector = new Array(teamCount * 2).fill(0);
  vector[homeIndex] = 1;
  vector[teamCount + awayIndex] = 1;
  return vector;
}

function oneHotLabel(target: number): number[] {
  return [target === 0 ? 1 : 0, target === 1 ? 1 : 0, target === 2 ? 1 : 0];
}

function createEncodedDataset(samples: EncodedSample[], teamCount: number): EncodedDataset {
  return {
    xs: samples.map((sample) => createMatchFeatureVector(sample.home, sample.away, teamCount)),
    ys: samples.map((sample) => oneHotLabel(sample.target)),
  };
}

function createOptimizer(name: TrainParameters["optimizer"], learningRate: number): tf.Optimizer {
  if (name === "rmsprop") {
    return tf.train.rmsprop(learningRate);
  }

  return tf.train.adam(learningRate);
}

function createModel(inputSize: number, params: TrainParameters): tf.LayersModel {
  // L2 regularization is applied to all layers, including the output layer, to help prevent overfitting.
  const regularizer = tf.regularizers.l2({ l2: params.l2_lambda });
  // A unique modelId is generated to ensure that layer names are unique across different training sessions,
  const model = tf.sequential();
  const modelId = Date.now().toString(36);

  params.hidden_layers.forEach((units, index) => {
    model.add(
      // Each hidden layer uses ReLU activation and He initialization, which are good defaults for deep networks.
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
      // Dropout layers are added after each hidden layer except the last one, to help prevent overfitting by randomly dropping units during training.
      model.add(tf.layers.dropout({ rate: params.dropout_rate, name: `dropout_${index + 1}_${modelId}` }));
    }
  });

  // The output layer uses softmax activation to produce probabilities for each of the three classes (home win, draw, away win).
  model.add(tf.layers.dense({ name: `dense_output_${modelId}`, units: 3, activation: "softmax" }));

  // The model is compiled with the specified optimizer, categorical crossentropy loss (suitable for multi-class classification), and accuracy as a metric to track during training.
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
    const persistedState = await loadPersistedModelState(MODEL_STATE_FILE);
    if (!persistedState) {
      modelState = null;
      tfModel = null;
      return;
    }

    if (!persistedState?.metadata || !Array.isArray(persistedState.metadata.teams)) {
      throw new Error("Estado do modelo inválido.");
    }

    const inputSize = persistedState.metadata.teams.length * 2;
    const loadedModel = createModel(inputSize, normalizeAndValidateTrainParameters({}));

    const tensors = persistedState.weightValues.map((values, index) => {
      const shape = persistedState.weightShapes[index];
      // The weights are loaded as flat arrays and reshaped into their original dimensions using the stored shapes. 
      // This allows the model to be reconstructed with the same parameters it had during training.
      return tf.tensor(values, shape, "float32");
    });

    // Once all tensors are created, they are set as the weights of the loaded model. 
    // After setting the weights, the individual tensors are disposed to free up memory, since the model now holds references to them.
    loadedModel.setWeights(tensors);
    tensors.forEach((tensor) => tensor.dispose());

    modelState = persistedState.metadata;
    tfModel = loadedModel;
  } catch {
    modelState = null;
    tfModel = null;
  }
}

async function persistModel(state: ModelMetadata, model: tf.LayersModel): Promise<void> {
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

  await persistModelState(MODEL_STATE_FILE, persisted);
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(() => resolve());
  });
}

function ensureNoTrainingInProgress(): void {
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
}

type NormalizedMatchRow = {
  homeTeam: string;
  awayTeam: string;
  target: number;
};

type PreparedTrainingData = {
  teams: string[];
  trainDataset: EncodedDataset;
  testDataset: EncodedDataset;
  featureCount: number;
};

type TrainingTensors = {
  xsTrain: tf.Tensor2D;
  ysTrain: tf.Tensor2D;
  xsTest: tf.Tensor2D;
  ysTest: tf.Tensor2D;
};

function normalizeTrainingRows(rows: Awaited<ReturnType<typeof loadMatches>>): NormalizedMatchRow[] {
  return rows
    .map((row) => {
      const homeTeam = row.homeTeam?.trim();
      const awayTeam = row.awayTeam?.trim();
      const homeGoals = Number(row.homeScore);
      const awayGoals = Number(row.awayScore);

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
    .filter((row): row is NormalizedMatchRow => row !== null);
}

function buildEncodedSamples(rows: NormalizedMatchRow[], teams: string[]): EncodedSample[] {
  const teamToIndex = new Map<string, number>();
  teams.forEach((team, index) => teamToIndex.set(team, index));

  return rows.map((row) => ({
    home: teamToIndex.get(row.homeTeam) ?? 0,
    away: teamToIndex.get(row.awayTeam) ?? 0,
    target: row.target,
  }));
}

function splitTrainAndTestSamples(encoded: EncodedSample[], testSize: number): { trainSamples: EncodedSample[]; testSamples: EncodedSample[] } {
  const totalRows = encoded.length;
  const testCount = Math.max(1, Math.round(totalRows * testSize));
  const trainCount = Math.max(1, totalRows - testCount);

  if (trainCount < 1 || totalRows - trainCount < 1) {
    throw new Error("Não foi possível separar base de treino/teste com os parâmetros informados.");
  }

  return {
    trainSamples: encoded.slice(0, trainCount),
    testSamples: encoded.slice(trainCount),
  };
}

async function prepareTrainingData(params: TrainParameters): Promise<PreparedTrainingData> {
  const rows = await loadMatches();
  const normalizedRows = normalizeTrainingRows(rows);

  const teams = Array.from(new Set(normalizedRows.flatMap((row) => [row.homeTeam, row.awayTeam]))).sort((left, right) =>
    left.localeCompare(right),
  );

  if (teams.length === 0 || normalizedRows.length < 4) {
    throw new Error("Base insuficiente para treinamento.");
  }

  const encodedSamples = buildEncodedSamples(normalizedRows, teams);
  const { trainSamples, testSamples } = splitTrainAndTestSamples(encodedSamples, params.test_size);

  const teamCount = teams.length;

  return {
    teams,
    trainDataset: createEncodedDataset(trainSamples, teamCount),
    testDataset: createEncodedDataset(testSamples, teamCount),
    featureCount: teamCount * 2,
  };
}

function createTrainingTensors(data: PreparedTrainingData): TrainingTensors {
  // The training and testing datasets are converted into TensorFlow tensors, which are the primary data structures used for model training and inference.
  return {
    xsTrain: tf.tensor2d(data.trainDataset.xs, [data.trainDataset.xs.length, data.featureCount], "float32"),
    ysTrain: tf.tensor2d(data.trainDataset.ys, [data.trainDataset.ys.length, 3], "float32"),
    xsTest: tf.tensor2d(data.testDataset.xs, [data.testDataset.xs.length, data.featureCount], "float32"),
    ysTest: tf.tensor2d(data.testDataset.ys, [data.testDataset.ys.length, 3], "float32"),
  };
}

function disposeTrainingTensors(tensors: TrainingTensors): void {
  tensors.xsTrain.dispose();
  tensors.ysTrain.dispose();
  tensors.xsTest.dispose();
  tensors.ysTest.dispose();
}

async function fitModelWithTrainingStatus(
  model: tf.LayersModel,
  tensors: TrainingTensors,
  params: TrainParameters,
  effectiveEpochs: number,
): Promise<number> {
  let bestValLoss = Number.POSITIVE_INFINITY;
  let noImprovementEpochs = 0;
  let completedEpochs = 0;
  const minimumEpochsBeforeEarlyStopping = Math.min(
    effectiveEpochs,
    Math.max(10, params.early_stopping_patience * 2),
  );
  const totalTrainSamples = tensors.xsTrain.shape[0] ?? 0;
  const batchesPerEpoch = Math.max(1, Math.ceil(totalTrainSamples / Math.max(1, params.batch_size)));

  // The model is trained using the fit method, which takes the training tensors and various training parameters.
  // A custom callback is provided to the fit method to update the training status after each epoch, allowing for real-time tracking of training progress and metrics.
  await model.fit(tensors.xsTrain, tensors.ysTrain, {
    epochs: effectiveEpochs,
    batchSize: params.batch_size,
    validationData: [tensors.xsTest, tensors.ysTest],
    shuffle: true,
    callbacks: {
      onBatchEnd: async (batch: number) => {
        const batchFraction = Math.min(1, (batch + 1) / batchesPerEpoch);
        const totalEpochsForProgress = Math.max(1, trainingStatus.total_epochs || effectiveEpochs);
        const currentProgress = ((completedEpochs + batchFraction) / totalEpochsForProgress) * 100;
        trainingStatus.progress = Number(Math.min(99.9, currentProgress).toFixed(2));
        await yieldToEventLoop();
      },
      onEpochEnd: async (epoch: number, logs?: tf.Logs) => {
        const trainAccuracy = toNonNegativeMetric(logs?.acc ?? logs?.accuracy);
        const validAccuracy = toNonNegativeMetric(logs?.val_acc ?? logs?.val_accuracy);
        const trainLoss = toNonNegativeMetric(logs?.loss);
        const validLoss = toNonNegativeMetric(logs?.val_loss);

        const currentEpoch = epoch + 1;
        let totalEpochsForProgress = effectiveEpochs;
        completedEpochs = currentEpoch;

        trainingStatus.current_epoch = currentEpoch;
        trainingStatus.total_epochs = effectiveEpochs;
        trainingStatus.history.accuracy.push(trainAccuracy);
        trainingStatus.history.val_accuracy.push(validAccuracy);
        trainingStatus.history.loss.push(trainLoss);
        trainingStatus.history.val_loss.push(validLoss);

        const canApplyEarlyStopping =
          params.early_stopping_patience > 0 &&
          currentEpoch >= minimumEpochsBeforeEarlyStopping;

        if (canApplyEarlyStopping && validLoss > 0) {
          if (validLoss < bestValLoss - params.early_stopping_min_delta) {
            bestValLoss = validLoss;
            noImprovementEpochs = 0;
          } else {
            noImprovementEpochs += 1;
            if (noImprovementEpochs >= params.early_stopping_patience) {
              const stoppableModel = model as tf.LayersModel & { stopTraining?: boolean };
              stoppableModel.stopTraining = true;
              trainingStatus.total_epochs = currentEpoch;
              totalEpochsForProgress = currentEpoch;
            }
          }
        }

        trainingStatus.progress = Number(((currentEpoch / totalEpochsForProgress) * 100).toFixed(2));

        await yieldToEventLoop();
      },
    },
  });

  return trainingStatus.history.val_accuracy.at(-1) ?? 0;
}

async function finalizeTrainedModel(model: tf.LayersModel, teams: string[], finalTestAccuracy: number): Promise<TrainResult> {
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
}

export async function nodeTrainModel(payload: unknown): Promise<TrainResult> {
  await ensureModelLoaded();

  ensureNoTrainingInProgress();

  const params = normalizeAndValidateTrainParameters(payload);
  const preparedData = await prepareTrainingData(params);

  const effectiveEpochs = Math.min(params.epochs, FAST_MODE_MAX_EPOCHS);
  resetTrainingStatus(effectiveEpochs);

  let tensors: TrainingTensors | null = null;
  let model: tf.LayersModel | null = null;

  try {
    tensors = createTrainingTensors(preparedData);

    if (tfModel) {
      tfModel.dispose();
      tfModel = null;
    }
    tf.disposeVariables();

    model = createModel(preparedData.featureCount, params);
    const finalTestAccuracy = await fitModelWithTrainingStatus(model, tensors, params, effectiveEpochs);

    return finalizeTrainedModel(model, preparedData.teams, finalTestAccuracy);
  } catch (error) {
    model?.dispose();
    trainingStatus.in_progress = false;
    trainingStatus.progress = 0;
    throw error;
  } finally {
    if (tensors) {
      disposeTrainingTensors(tensors);
    }
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

  const predictionData = normalizeAndValidatePredictData(payload);
  const teamToIndex = new Map<string, number>();
  modelState.teams.forEach((team, index) => teamToIndex.set(team, index));

  if (!teamToIndex.has(predictionData.homeTeam) || !teamToIndex.has(predictionData.awayTeam)) {
    throw new Error("Time não encontrado na base treinada.");
  }

  const homeIndex = teamToIndex.get(predictionData.homeTeam) ?? 0;
  const awayIndex = teamToIndex.get(predictionData.awayTeam) ?? 0;
  const encodedFeatures = createMatchFeatureVector(homeIndex, awayIndex, modelState.teams.length);

  // The encoded feature vector for the input match is created and converted into a 2D tensor with shape [1, featureCount], where featureCount is twice the number of teams (one-hot encoding for home and away teams).
  const input = tf.tensor2d([encodedFeatures], [1, encodedFeatures.length], "float32");
  // The model's predict method is called with the input tensor, which returns a tensor containing the predicted probabilities for each class (home win, draw, away win). The data from this output tensor is extracted into a JavaScript array for further processing.
  const output = tfModel.predict(input) as tf.Tensor;
  const probabilityData = await output.data();
  const probabilities = Array.from(probabilityData);

  input.dispose();
  output.dispose();

  const topIndex = argMax(probabilities);

  return {
    prediction: PREDICTION_LABELS[topIndex],
    probabilities: {
      HOME: probabilities[0],
      DRAW: probabilities[1],
      AWAY: probabilities[2],
    },
    modelVersion: modelState.version,
  };
}