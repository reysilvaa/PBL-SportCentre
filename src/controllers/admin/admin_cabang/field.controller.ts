import { Response } from 'express';
import prisma from '../../../config/database';
import { createFieldSchema, updateFieldSchema } from '../../../zod-schemas/field.schema';
import { User } from '../../../middlewares/auth.middleware';
import { deleteCachedDataByPattern } from '../../../utils/cache';

// Get all fields for admin's or owner's branch only
export const getFields = async (req: User, res: Response): Promise<void> => {
  try {
    // userBranch sudah ditambahkan oleh adminBranchMiddleware
    const branch = req.userBranch!;

    const fields = await prisma.field.findMany({
      where: {
        branchId: branch.id
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
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error
    });
  }
};

// Create field for admin's or owner's branch only
export const createField = async (req: User, res: Response): Promise<void> => {
  try {
    // userBranch sudah ditambahkan oleh adminBranchMiddleware
    const branch = req.userBranch!;
    
    // Validasi data dengan Zod
    const result = createFieldSchema.safeParse({
      ...req.body,
      branchId: branch.id // Force branchId to be user's branch
    });
    
    if (!result.success) {
      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        error: result.error.format()
      });
      return;
    }
    
    // Get data after validation
    const { branchId, typeId, name, priceDay, priceNight, status } = result.data;
    
    // Save to database
    const newField = await prisma.field.create({
      data: {
        branchId,
        typeId,
        name,
        priceDay,
        priceNight,
        status,
      }
    });
    
    // Hapus cache yang relevan
    deleteCachedDataByPattern('fields');
    deleteCachedDataByPattern('admin_fields');
    deleteCachedDataByPattern('fields_availability');
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_FIELD',
        details: `Membuat lapangan baru "${name}" untuk cabang ${branch.name}`
      }
    });
    
    res.status(201).json({
      status: true,
      message: 'Berhasil membuat lapangan baru',
      data: newField
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error
    });
  }
};

// Update field for admin's or owner's branch only
export const updateField = async (req: User, res: Response): Promise<void> => {
  try {
    // userBranch sudah ditambahkan oleh adminBranchMiddleware
    const branch = req.userBranch!;
    
    const { id } = req.params;
    const fieldId = parseInt(id);
    
    // Check if field exists and belongs to user's branch
    const existingField = await prisma.field.findUnique({
      where: { id: fieldId }
    });
    
    if (!existingField) {
      res.status(404).json({
        status: false,
        message: 'Lapangan tidak ditemukan'
      });
      return;
    }
    
    if (existingField.branchId !== branch.id) {
      res.status(403).json({
        status: false,
        message: 'Forbidden: Anda hanya dapat mengelola lapangan di cabang Anda sendiri'
      });
      return;
    }
    
    // Validasi data dengan Zod
    const result = updateFieldSchema.safeParse(req.body);
    
    if (!result.success) {
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
    deleteCachedDataByPattern('fields');
    deleteCachedDataByPattern('admin_fields');
    deleteCachedDataByPattern('admin_field_detail');
    deleteCachedDataByPattern('fields_availability');
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_FIELD',
        details: `Memperbarui lapangan "${updatedField.name}" (ID: ${fieldId}) di cabang ${branch.name}`
      }
    });
    
    res.status(200).json({
      status: true,
      message: 'Berhasil memperbarui lapangan',
      data: updatedField
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: 'Gagal memperbarui lapangan',
      error: error
    });
  }
};

// Delete field for admin's or owner's branch only
export const deleteField = async (req: User, res: Response): Promise<void> => {
  try {
    // userBranch sudah ditambahkan oleh adminBranchMiddleware
    const branch = req.userBranch!;
    
    const { id } = req.params;
    const fieldId = parseInt(id);
    
    // Check if field exists and belongs to user's branch
    const existingField = await prisma.field.findUnique({
      where: { id: fieldId }
    });
    
    if (!existingField) {
      res.status(404).json({
        status: false,
        message: 'Lapangan tidak ditemukan'
      });
      return;
    }
    
    if (existingField.branchId !== branch.id) {
      res.status(403).json({
        status: false,
        message: 'Forbidden: Anda hanya dapat mengelola lapangan di cabang Anda sendiri'
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
    
    // Delete field
    await prisma.field.delete({
      where: { id: fieldId }
    });
    
    // Hapus cache yang relevan
    deleteCachedDataByPattern('fields');
    deleteCachedDataByPattern('admin_fields');
    deleteCachedDataByPattern('admin_field_detail');
    deleteCachedDataByPattern('fields_availability');
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_FIELD',
        details: `Menghapus lapangan "${existingField.name}" (ID: ${fieldId}) dari cabang ${branch.name}`
      }
    });
    
    res.status(200).json({
      status: true,
      message: 'Berhasil menghapus lapangan'
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: 'Gagal menghapus lapangan',
      error: error
    });
  }
};

// Get a single field by ID
export const getFieldById = async (req: User, res: Response): Promise<void> => {
  try {
    // userBranch sudah ditambahkan oleh adminBranchMiddleware
    const branch = req.userBranch!;
    
    const { id } = req.params;
    const fieldId = parseInt(id);
    
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
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
        message: 'Lapangan tidak ditemukan'
      });
      return;
    }
    
    if (field.branchId !== branch.id) {
      res.status(403).json({
        status: false,
        message: 'Forbidden: Anda hanya dapat melihat lapangan di cabang Anda sendiri'
      });
      return;
    }
    
    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan data lapangan',
      data: field
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
      error: error
    });
  }
};