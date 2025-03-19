import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';
import { Request } from 'express';

// Define interfaces for Multer request types
export interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export interface MulterRequestWithFiles extends Request {
  files?: {
    [fieldname: string]: Express.Multer.File[];
  } | Express.Multer.File[];
}

// Configure Cloudinary storage for field images
const fieldStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'PBL/fields-images',
      format: file.mimetype.split('/')[1],
      transformation: [{ width: 800, height: 600, crop: 'limit' }]
    };
  }
});

// Create field image upload middleware
export const fieldUpload = multer({ storage: fieldStorage });

// Generic upload configuration if needed for other purposes
const genericStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'PBL/uploads',
      format: file.mimetype.split('/')[1]
    };
  }
});

export const genericUpload = multer({ storage: genericStorage });