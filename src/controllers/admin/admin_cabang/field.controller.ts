import { Response } from 'express';
import prisma from '../../../config/database';
import { createFieldSchema, updateFieldSchema } from '../../../zod-schemas/field.schema';
import { User } from '../../../middlewares/auth.middleware';
import { deleteCachedDataByPattern } from '../../../utils/cache.utils';
import { MulterRequest } from '../../../middlewares/multer.middleware';
import { cleanupUploadedFile } from '../../../utils/cloudinary.utils';

// Constants for folder paths
const FIELDS_FOLDER = 'PBL/fields-images';

// Get all fields for admin's or owner's branch
export const getFields = async (req: User, res: Response): Promise<void> => {
  if (res.headersSent) return;
  
  try {
    // Get branch ID from middleware
    const branchId = req.userBranch?.id;
    
    if (!branchId) {
      res.status(400).json({
        status: false,
        message: 'Branch ID is required'
      });
      return;
    }
    
    const fields = await prisma.field.findMany({
      where: {
        branchId
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        type: true
      }
    });
    
    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan data lapangan',
      data: fields
    });
  } catch (error) {
    console.error('Error getting fields:', error);
    if (!res.headersSent) {
      res.status(500).json({
        status: false,
        message: 'Internal Server Error'
      });
    }
  }
};

// Create field with image upload
export const createField = async (req: MulterRequest & User, res: Response): Promise<void> => {
  if (res.headersSent) return;
  
  try {
    // Get branch ID from middleware
    const branchId = req.userBranch?.id;
    
    if (!branchId) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      
      res.status(400).json({
        status: false,
        message: 'Branch ID is required'
      });
      return;
    }
    
    // Get branch name for the activity log
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true }
    });
    
    // Validasi data dengan Zod
    const result = createFieldSchema.safeParse({
      ...req.body,
      branchId, // Force branchId to be user's branch from middleware
      typeId: req.body.typeId ? parseInt(req.body.typeId) : undefined
    });
    
    if (!result.success) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      
      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        error: result.error.format()
      });
      return;
    }
    
    // Get data after validation
    const validatedData = result.data;
    
    // Save to database dengan tambahan imageUrl jika ada
    const newField = await prisma.field.create({
      data: {
        ...validatedData,
        imageUrl: req.file?.path || null // Add image URL if file was uploaded
      }
    });
    console.log(req.file?.path); // Path file yang diunggah
    console.log(req.FOLDER?.path); // Path folder yang digunakan
    
    // Hapus cache yang relevan
    await deleteCachedDataByPattern('fields');
    await deleteCachedDataByPattern('admin_fields');
    await deleteCachedDataByPattern('fields_availability');
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_FIELD',
        details: `Membuat lapangan baru "${validatedData.name}" untuk cabang ${branch?.name || branchId}`,
        ipAddress: req.ip || undefined
      }
    });
    
    res.status(201).json({
      status: true,
      message: 'Berhasil membuat lapangan baru',
      data: newField
    });
  } catch (error) {
    console.error('Error creating field:', error);
    
    // Clean up uploaded file if exists
    if (req.file?.path) {
      await cleanupUploadedFile(req.file.path);
    }
    
    res.status(500).json({
      status: false,
      message: 'Internal Server Error'
    });
  }
};

// Update field with image upload
export const updateField = async (req: MulterRequest & User, res: Response): Promise<void> => {
  if (res.headersSent) return;
  
  try {
    const { id } = req.params;
    const fieldId = parseInt(id);
    
    if (isNaN(fieldId)) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      
      res.status(400).json({
        status: false,
        message: 'Invalid field ID'
      });
      return;
    }
    
    // Get branch ID from middleware
    const branchId = req.userBranch?.id;
    
    if (!branchId) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      
      res.status(400).json({
        status: false,
        message: 'Branch ID is required'
      });
      return;
    }
    
    // Check if field exists and belongs to the user's branch
    const existingField = await prisma.field.findFirst({
      where: { 
        id: fieldId,
        branchId
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    if (!existingField) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      
      res.status(404).json({
        status: false,
        message: 'Lapangan tidak ditemukan atau tidak berada dalam cabang Anda'
      });
      return;
    }
    
    // Persiapkan data untuk update
    const updateData = { ...req.body };
    
    // Parse typeId if it exists
    if (updateData.typeId) {
      updateData.typeId = parseInt(updateData.typeId);
    }
    
    // Ensure branchId is not changed to another branch
    if (updateData.branchId && parseInt(updateData.branchId) !== branchId) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      
      res.status(403).json({
        status: false,
        message: 'Forbidden: Tidak dapat memindahkan lapangan ke cabang lain'
      });
      return;
    }
    
    // Force branchId to be user's branch from middleware
    updateData.branchId = branchId;
    
    // Jika ada file baru yang diupload
    if (req.file?.path) {
      updateData.imageUrl = req.file.path;
      
      // Hapus gambar lama jika ada
      if (existingField.imageUrl) {
        await cleanupUploadedFile(existingField.imageUrl);
      }
    }
    
    // Validasi data dengan Zod
    const result = updateFieldSchema.safeParse(updateData);
    
    if (!result.success) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      
      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        errors: result.error.format()
      });
      return;
    }
    
    const updatedField = await prisma.field.update({
      where: { id: fieldId },
      data: result.data
    });
    
    // Hapus cache yang relevan
    await deleteCachedDataByPattern('fields');
    await deleteCachedDataByPattern('admin_fields');
    await deleteCachedDataByPattern('admin_field_detail');
    await deleteCachedDataByPattern('fields_availability');
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_FIELD',
        details: `Memperbarui lapangan "${updatedField.name}" (ID: ${fieldId}) di cabang ${existingField.branch.name}`,
        ipAddress: req.ip || undefined
      }
    });
    
    res.status(200).json({
      status: true,
      message: 'Berhasil memperbarui lapangan',
      data: updatedField
    });
  } catch (error) {
    console.error('Error updating field:', error);
    
    // Clean up uploaded file if exists
    if (req.file?.path) {
      await cleanupUploadedFile(req.file.path);
    }
    
    res.status(500).json({
      status: false,
      message: 'Gagal memperbarui lapangan'
    });
  }
};

// Delete field
export const deleteField = async (req: User, res: Response): Promise<void> => {
  if (res.headersSent) return;
  
  try {
    const { id } = req.params;
    const fieldId = parseInt(id);
    
    if (isNaN(fieldId)) {
      res.status(400).json({
        status: false,
        message: 'Invalid field ID'
      });
      return;
    }
    
    // Get branch ID from middleware
    const branchId = req.userBranch?.id;
    
    if (!branchId) {
      res.status(400).json({
        status: false,
        message: 'Branch ID is required'
      });
      return;
    }
    
    // Check if field exists and belongs to the user's branch
    const existingField = await prisma.field.findFirst({
      where: { 
        id: fieldId,
        branchId
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    if (!existingField) {
      res.status(404).json({
        status: false,
        message: 'Lapangan tidak ditemukan atau tidak berada dalam cabang Anda'
      });
      return;
    }
    
    // Check if field has any bookings
    const bookings = await prisma.booking.findFirst({
      where: { fieldId }
    });
    
    if (bookings) {
      res.status(400).json({
        status: false,
        message: 'Tidak dapat menghapus lapangan yang memiliki pemesanan'
      });
      return;
    }
    
    // Delete image from Cloudinary if exists
    if (existingField.imageUrl) {
      await cleanupUploadedFile(existingField.imageUrl);
    }
    
    // Delete field
    await prisma.field.delete({
      where: { id: fieldId }
    });
    
    // Hapus cache yang relevan
    await deleteCachedDataByPattern('fields');
    await deleteCachedDataByPattern('admin_fields');
    await deleteCachedDataByPattern('admin_field_detail');
    await deleteCachedDataByPattern('fields_availability');
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_FIELD',
        details: `Menghapus lapangan "${existingField.name}" (ID: ${fieldId}) dari cabang ${existingField.branch.name}`,
        ipAddress: req.ip || undefined
      }
    });
    
    res.status(200).json({
      status: true,
      message: 'Berhasil menghapus lapangan'
    });
  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({
      status: false,
      message: 'Gagal menghapus lapangan'
    });
  }
};

// Get a single field by ID
export const getFieldById = async (req: User, res: Response): Promise<void> => {
  if (res.headersSent) return;
  
  try {
    const { id } = req.params;
    const fieldId = parseInt(id);
    
    if (isNaN(fieldId)) {
      res.status(400).json({
        status: false,
        message: 'Invalid field ID'
      });
      return;
    }
    
    // Get branch ID from middleware
    const branchId = req.userBranch?.id;
    
    if (!branchId) {
      res.status(400).json({
        status: false,
        message: 'Branch ID is required'
      });
      return;
    }
    
    // Check if field exists and belongs to the user's branch
    const field = await prisma.field.findFirst({
      where: { 
        id: fieldId,
        branchId
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        type: true
      }
    });
    
    if (!field) {
      res.status(404).json({
        status: false,
        message: 'Lapangan tidak ditemukan atau tidak berada dalam cabang Anda'
      });
      return;
    }
    
    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan data lapangan',
      data: field
    });
  } catch (error) {
    console.error('Error getting field by ID:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error'
    });
  }
};