import path from "node:path";

export type TrainParameters = {
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

export type PredictData = {
  homeTeam: string;
  awayTeam: string;
};

export type TrainingHistory = {
  accuracy: number[];
  val_accuracy: number[];
  loss: number[];
  val_loss: number[];
};

export type ModelMetadata = {
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
  prediction: "HOME" | "DRAW" | "AWAY";
  probabilities: {
    HOME: number;
    DRAW: number;
    AWAY: number;
  };
  modelVersion: string;
};

export type PersistedModelState = {
  metadata: ModelMetadata;
  weightShapes: number[][];
  weightValues: number[][];
};

export type EncodedSample = {
  home: number;
  away: number;
  target: number;
};

export type EncodedDataset = {
  xs: number[][];
  ys: number[][];
};

export const PREDICTION_LABELS = ["HOME", "DRAW", "AWAY"] as const;
export const FAST_MODE_MAX_EPOCHS = 40;
export const ARTIFACTS_DIR = path.resolve(process.cwd(), ".artifacts");
export const TFJS_MODEL_DIR = path.resolve(ARTIFACTS_DIR, "match-predictor-tfjs");
export const MODEL_STATE_FILE = path.resolve(TFJS_MODEL_DIR, "model-state.json");

export function createEmptyTrainingHistory(): TrainingHistory {
  return {
    accuracy: [],
    val_accuracy: [],
    loss: [],
    val_loss: [],
  };
}