import { jest, describe, it, expect } from '@jest/globals';
import * as cloudinaryUtils from '../../../src/utils/cloudinary.utils';
import { extractPublicId, deleteImage, cleanupUploadedFile } from '../../../src/utils/cloudinary.utils';

// Mock the cloudinary service
jest.mock('../../../src/config/services/cloudinary', () => {
  const mockDestroy = jest.fn().mockResolvedValue({ result: 'ok' });
  
  return {
    __esModule: true,
    default: {
      uploader: {
        destroy: mockDestroy
      }
    }
  };
});

describe('Cloudinary Utils', () => {
  describe('extractPublicId', () => {
    it('should extract public ID from Cloudinary URL', () => {
      // Arrange
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample_image.jpg';
      
      // Act
      const result = extractPublicId(cloudinaryUrl);
      
      // Assert
      expect(result).toBe('sample_image');
    });
    
    it('should handle different URL formats', () => {
      // Arrange
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/folder/subfolder/sample_image.png';
      
      // Act
      const result = extractPublicId(cloudinaryUrl);
      
      // Assert
      expect(result).toBe('sample_image');
    });
    
    it('should return null for invalid URLs', () => {
      // Act & Assert
      expect(extractPublicId('')).toBeNull();
      expect(extractPublicId(null as any)).toBeNull();
    });
    
    it('should handle errors gracefully', () => {
      // Arrange
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act
      const result = extractPublicId({} as any);
      
      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('deleteImage', () => {
    it('should call cloudinary uploader.destroy with public ID', async () => {
      // Arrange
      const publicId = 'sample_image';
      const cloudinary = require('../../../src/config/services/cloudinary').default;
      
      // Act
      await deleteImage(publicId);
      
      // Assert
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(publicId);
    });
    
    it('should not call cloudinary if publicId is empty', async () => {
      // Arrange
      const cloudinary = require('../../../src/config/services/cloudinary').default;
      cloudinary.uploader.destroy.mockClear();
      
      // Act
      await deleteImage('');
      
      // Assert
      expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      // Arrange
      const cloudinary = require('../../../src/config/services/cloudinary').default;
      cloudinary.uploader.destroy.mockRejectedValueOnce(new Error('Cloudinary error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act & Assert
      await expect(deleteImage('error_image')).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('cleanupUploadedFile', () => {
    it('should call deleteImage for Cloudinary URLs', async () => {
      // Arrange
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample_image.jpg';
      const extractSpy = jest.spyOn(cloudinaryUtils, 'extractPublicId');
      const deleteSpy = jest.spyOn(cloudinaryUtils, 'deleteImage').mockResolvedValue();
      
      // Act
      await cleanupUploadedFile(cloudinaryUrl);
      
      // Assert
      expect(extractSpy).toHaveBeenCalledWith(cloudinaryUrl);
      expect(deleteSpy).toHaveBeenCalledWith('sample_image');
      
      // Restore
      extractSpy.mockRestore();
      deleteSpy.mockRestore();
    });
    
    it('should not call deleteImage for non-Cloudinary URLs', async () => {
      // Arrange
      const nonCloudinaryUrl = 'https://example.com/image.jpg';
      const deleteSpy = jest.spyOn(cloudinaryUtils, 'deleteImage').mockResolvedValue();
      
      // Act
      await cleanupUploadedFile(nonCloudinaryUrl);
      
      // Assert
      expect(deleteSpy).not.toHaveBeenCalled();
      
      // Restore
      deleteSpy.mockRestore();
    });
    
    it('should do nothing if fileUrl is empty', async () => {
      // Arrange
      const extractSpy = jest.spyOn(cloudinaryUtils, 'extractPublicId');
      const deleteSpy = jest.spyOn(cloudinaryUtils, 'deleteImage').mockResolvedValue();
      
      // Act
      await cleanupUploadedFile();
      
      // Assert
      expect(extractSpy).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();
      
      // Restore
      extractSpy.mockRestore();
      deleteSpy.mockRestore();
    });
    
    it('should handle errors gracefully', async () => {
      // Arrange
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample_image.jpg';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const extractSpy = jest.spyOn(cloudinaryUtils, 'extractPublicId').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Act
      await cleanupUploadedFile(cloudinaryUrl);
      
      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore
      consoleErrorSpy.mockRestore();
      extractSpy.mockRestore();
    });
  });
}); 