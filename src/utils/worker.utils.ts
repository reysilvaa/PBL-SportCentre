import { Worker } from 'worker_threads';
import path from 'path';
import { ImageWorkerData, WorkerResponse } from '../types/worker';

export function createImageWorker(imageData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, '../workers/imageWorker.ts'),
      {
        workerData: { imageData } as ImageWorkerData,
      },
    );

    worker.on('message', (result: WorkerResponse<string>) => {
      if (result.success && result.data) {
        resolve(result.data);
      } else {
        reject(new Error(result.error || 'Unknown error occurred'));
      }
    });

    worker.on('error', (error) => {
      reject(error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
