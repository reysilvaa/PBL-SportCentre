import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/services/cloudinary';
import { NextFunction, Request } from 'express';

// Define interfaces for Multer request types
export interface MulterRequest extends Request {
  file?: Express.Multer.File;
  FOLDER?: {
    path: string;
  };
}

export interface MulterRequestWithFiles extends Request {
  files?:
    | {
        [fieldname: string]: Express.Multer.File[];
      }
    | Express.Multer.File[];
  FOLDER?: {
    path: string;
  };
}

// Define folder path types for better organization
export type FolderPath = 'fields' | 'users' | 'branches' | 'other';

// Get folder path based on type
const getFolderPath = (type: FolderPath = 'other'): string => {
  const basePath = 'PBL';

  switch (type) {
    case 'fields':
      return `${basePath}/fields-images`;
    case 'users':
      return `${basePath}/users-images`;
    case 'branches':
      return `${basePath}/branches-images`;
    default:
      return `${basePath}/uploads`;
  }
};

// Configure Cloudinary storage with dynamic folder path
const createStorage = (folderType: FolderPath) => {
  return new CloudinaryStorage({
    cloudinary,
    params: async (req: MulterRequest, file) => {
      // Get folder from request body if specified, otherwise use the default from folderType
      const folder = req.body?.folder || getFolderPath(folderType);

      // Store folder path in request for later use
      if (!req.FOLDER) {
        req.FOLDER = { path: folder };
      }

      const options: any = {
        folder: folder,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif'], // Restrict to image formats
        format: 'auto', // Auto-detect best format
      };

      // Apply specific transformations based on folder type
      if (folderType === 'fields') {
        options.transformation = [
          { width: 800, height: 600, crop: 'limit', quality: 'auto' },
        ];
      } else if (folderType === 'users') {
        options.transformation = [
          {
            width: 400,
            height: 400,
            crop: 'fill',
            gravity: 'face',
            quality: 'auto',
          },
        ];
      } else if (folderType === 'branches') {
        options.transformation = [
          { width: 1200, height: 800, crop: 'limit', quality: 'auto' },
        ];
      }

      return options;
    },
  });
};

// File filter to restrict uploads to images only
const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Create specialized upload middlewares
export const fieldUpload = multer({
  storage: createStorage('fields'),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: imageFileFilter,
});

export const userUpload = multer({
  storage: createStorage('users'),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: imageFileFilter,
});

export const branchUpload = multer({
  storage: createStorage('branches'),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: imageFileFilter,
});

export const genericUpload = multer({
  storage: createStorage('other'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper method to allow dynamic folder selection at runtime
export const dynamicUpload = (folderType: FolderPath = 'other') => {
  return multer({
    storage: createStorage(folderType),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB default limit
    },
    fileFilter: imageFileFilter,
  });
};

// Error handling middleware for multer errors
// export const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
//   if (err instanceof multer.MulterError) {
//     return res.status(400).json({
//       status: false,
//       message: 'File upload error',
//       error: err.message
//     });
//   } else if (err) {
//     return res.status(400).json({
//       status: false,
//       message: err.message || 'Unknown file upload error'
//     });
//   }
//   next();
// };
