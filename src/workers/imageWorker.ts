import { parentPort, workerData } from 'worker_threads';
import cloudinary from '../config/services/cloudinary';
import { ImageWorkerData, WorkerResponse } from '../types/worker';

async function cleanupUploadedFile(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error cleaning up uploaded file:', error);
  }
}

async function processImage(imageData: string) {
  try {
    const result = await cloudinary.uploader.upload(imageData, {
      folder: 'PBL/uploads',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
      transformation: [
        { width: 800, height: 800, crop: 'limit', quality: 'auto' },
      ],
    });
    parentPort?.postMessage({
      success: true,
      data: result.secure_url,
    } as WorkerResponse<string>);
  } catch (error: any) {
    // Cleanup file if upload fails
    if (error?.uploadedFile?.public_id) {
      await cleanupUploadedFile(error.uploadedFile.public_id);
    }
    parentPort?.postMessage({
      success: false,
      error: error?.message || 'Unknown error occurred',
    } as WorkerResponse);
  }
}

if (parentPort) {
  const { imageData } = workerData as ImageWorkerData;
  processImage(imageData);
}
