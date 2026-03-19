import {
  nodeGetModelInfo,
  nodeGetTrainStatus,
  nodePredict,
  nodeTrainModel,
  type ModelInfo,
  type TrainingStatus,
  type TrainResult,
  type PredictResult,
} from "@/lib/server/ml-node-service";

export function mlGet(path: "/model/info"): Promise<ModelInfo>;
export function mlGet(path: "/train/status"): Promise<TrainingStatus>;
export function mlGet(path: string): Promise<ModelInfo | TrainingStatus>;

export async function mlGet(path: string) {
  if (path === "/model/info") {
    return nodeGetModelInfo();
  }

  if (path === "/train/status") {
    return nodeGetTrainStatus();
  }

  throw new Error(`Rota GET de ML não suportada: ${path}`);
}

export function mlPost(path: "/train", payload: unknown): Promise<TrainResult>;
export function mlPost(path: "/predict", payload: unknown): Promise<PredictResult>;
export function mlPost(path: string, payload: unknown): Promise<TrainResult | PredictResult>;

export async function mlPost(path: string, payload: unknown) {
  if (path === "/train") {
    return nodeTrainModel(payload);
  }

  if (path === "/predict") {
    return nodePredict(payload);
  }

  throw new Error(`Rota POST de ML não suportada: ${path}`);
}
