import cloudinary from '../config/services/cloudinary';

/**
 * Helper function to extract public ID from Cloudinary URL
 * @param cloudinaryUrl Cloudinary URL
 * @returns Public ID or null if not found
 */
export const extractPublicId = (cloudinaryUrl: string): string | null => {
  if (!cloudinaryUrl) return null;

  try {
    // Extract the filename without extension
    const matches = cloudinaryUrl.match(/\/([^/]+)\.[\w]+$/);
    if (matches && matches[1]) {
      return matches[1];
    }

    // Alternative extraction in case the URL format is different
    const parts = cloudinaryUrl.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.split('.')[0] || null;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

/**
 * Helper function to delete images from Cloudinary
 * @param publicId Cloudinary public ID
 */
export const deleteImage = async (publicId: string): Promise<void> => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    // Log error but don't throw to prevent blocking the main operation
  }
};

/**
 * Helper function to clean up uploaded file
 * @param fileUrl URL of the file to clean up
 */
export const cleanupUploadedFile = async (fileUrl?: string): Promise<void> => {
  if (!fileUrl) return;

  try {
    // For Cloudinary URLs, extract public ID and delete
    if (fileUrl.includes('cloudinary.com')) {
      const publicId = extractPublicId(fileUrl);
      if (publicId) {
        await deleteImage(publicId);
      }
    }
    // Add handling for other storage providers if needed
  } catch (error) {
    console.error('Error cleaning up uploaded file:', error);
    // Log error but don't throw to prevent blocking the main operation
  }
};

export default cloudinary;
