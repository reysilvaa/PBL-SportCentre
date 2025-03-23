export interface ImageWorkerData {
  imageData: string;
}

export interface WorkerResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
