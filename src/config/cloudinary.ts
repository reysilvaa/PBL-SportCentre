import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to delete images from Cloudinary
export const deleteImage = async (publicId: string, folder = 'PBL/fields-images'): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(`${folder}/${publicId}`);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    // You might want to throw or handle the error depending on your requirements
  }
};

// Helper function to extract public ID from Cloudinary URL
export const extractPublicId = (cloudinaryUrl: string): string | null => {
  try {
    return cloudinaryUrl.split('/').pop()?.split('.')[0] || null;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

export default cloudinary;