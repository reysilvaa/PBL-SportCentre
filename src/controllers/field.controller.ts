import { Request, Response } from 'express';
import prisma from '../config/services/database';
import { createFieldSchema, updateFieldSchema } from '../zod-schemas/field.schema';
import { User } from '../middlewares/auth.middleware';
import { invalidateFieldCache } from '../utils/cache/cacheInvalidation.utils';
import { MulterRequest } from '../middlewares/multer.middleware';
import { cleanupUploadedFile } from '../utils/cloudinary.utils';
import { Role } from '../types';

/**
 * Unified Field Controller
 * Menggabungkan fungsionalitas dari semua controller field yang ada
 * dengan menggunakan middleware permission untuk kontrol akses
 */

// Public endpoint - Dapatkan semua lapangan
export const getAllFields = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;  
    const query = req.query.q as string || '';
    const branchId = parseInt(req.query.branchId as string) || 0;

    let whereCondition: any  = {};
    if (query) {
      whereCondition = {
        OR: [
          { name: { contains: query as string } }, 
          { type: {name: { contains: query as string }} },
          { branch: {name: { contains: query as string }} },
        ],
      };
    }

    if (branchId !== 0) {
      whereCondition.AND = [
        ...(whereCondition.OR ? [{ OR: whereCondition.OR }] : []),
        { branchId: branchId },
      ];
    }

    const totalItems = await prisma.field.count({
      where: whereCondition,
    });

    const fields = await prisma.field.findMany({
      where: whereCondition,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        type: true,
      },
    });

    res.json({
      data: fields,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Endpoint untuk mendapatkan lapangan berdasarkan ID cabang (dengan parameter di path)
export const getBranchFields = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = parseInt(id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;  
    const query = req.query.q as string || '';
    console.log('Getting branch fields with query:', req.query);
    console.log('Getting branch fields with limit:', req.query.limit);
    console.log('Branch ID:', branchId);
    console.log('Query:', query);
    console.log('Page:', page);
    console.log('Limit:', limit);

    if (isNaN(branchId)) {
      res.status(400).json({
        status: false,
        message: 'ID cabang tidak valid',
      });
      return;
    }

    // Check jika branch ada
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      res.status(404).json({
        status: false,
        message: 'Cabang tidak ditemukan',
      });
      return;
    }

    let whereCondition: any  = {};
    if (query) {
      whereCondition = {
        OR: [
          { name: { contains: query as string } }, 
          { type: {name: { contains: query as string }} },
        ],
      };
    }

    if (branchId !== 0) {
      whereCondition.AND = [
        ...(whereCondition.OR ? [{ OR: whereCondition.OR }] : []),
        { branchId: branchId },
      ];
    }

    const totalItems = await prisma.field.count({
      where: whereCondition,
    });

    const fields = await prisma.field.findMany({
      where: whereCondition,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        type: true,
      },
    });

    // Dapatkan semua lapangan untuk cabang ini
    // const fields = await prisma.field.findMany({
    //   where: { branchId },
    //   include: {
    //     branch: {
    //       select: {
    //         id: true,
    //         name: true,
    //       },
    //     },
    //     type: true,
    //   },
    // });

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan daftar lapangan untuk cabang',
      data: fields,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error getting branch fields:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};

// Create field with image upload
export const createField = async (req: MulterRequest & User, res: Response): Promise<void> => {
  if (res.headersSent) return;

  try {
    // Get branch ID from middleware (akan diisi oleh permissionMiddleware)
    let branchId = req.userBranch?.id;

    // Super admin dapat menentukan branchId dari body request
    if (req.user?.role === 'super_admin' && req.body.branchId) {
      branchId = parseInt(req.body.branchId);

      // Verifikasi branch dengan ID tersebut ada
      const branchExists = await prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!branchExists) {
        // Clean up uploaded file if exists
        if (req.file?.path) {
          await cleanupUploadedFile(req.file.path);
        }

        res.status(400).json({
          status: false,
          message: 'Branch dengan ID tersebut tidak ditemukan',
        });
        return;
      }
    }

    if (!branchId) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }

      res.status(400).json({
        status: false,
        message: 'Branch ID is required',
      });
      return;
    }

    // Get branch name for the activity log
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    });

    // Validasi data dengan Zod
    const result = createFieldSchema.safeParse({
      ...req.body,
      branchId,
      typeId: req.body.typeId ? parseInt(req.body.typeId) : undefined,
    });

    if (!result.success) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }

      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        error: result.error.format(),
      });
      return;
    }

    // Get data after validation
    const validatedData = result.data;

    // Save to database dengan tambahan imageUrl jika ada
    const newField = await prisma.field.create({
      data: {
        ...validatedData,
        imageUrl: req.file?.path || null, // Add image URL if file was uploaded
      },
    });
    console.log(req.file?.path); // Path file yang diunggah
    console.log(req.FOLDER?.path); // Path folder yang digunakan

    // Hapus cache yang relevan
    await invalidateFieldCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_FIELD',
        details: `Membuat lapangan baru "${validatedData.name}" untuk cabang ${branch?.name || branchId}`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(201).json({
      status: true,
      message: 'Berhasil membuat lapangan baru',
      data: newField,
    });
  } catch (error) {
    console.error('Error creating field:', error);

    // Clean up uploaded file if exists
    if (req.file?.path) {
      await cleanupUploadedFile(req.file.path);
    }

    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
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
        message: 'Invalid field ID',
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
        message: 'Branch ID is required',
      });
      return;
    }

    // Super admin bisa mengakses dan mengubah lapangan manapun
    const whereCondition = req.user?.role === 'super_admin' ? { id: fieldId } : { id: fieldId, branchId };

    // Check if field exists and belongs to the user's branch
    const existingField = await prisma.field.findFirst({
      where: whereCondition,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!existingField) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }

      res.status(404).json({
        status: false,
        message: 'Lapangan tidak ditemukan atau tidak berada dalam cabang Anda',
      });
      return;
    }

    // Persiapkan data untuk update
    const updateData = { ...req.body };

    // Parse typeId if it exists
    if (updateData.typeId) {
      updateData.typeId = parseInt(updateData.typeId);
    }

    // Reguler user tidak bisa mengubah branchId
    if (req.user?.role !== 'super_admin') {
      // Ensure branchId is not changed to another branch
      if (updateData.branchId && parseInt(updateData.branchId) !== branchId) {
        // Clean up uploaded file if exists
        if (req.file?.path) {
          await cleanupUploadedFile(req.file.path);
        }

        res.status(403).json({
          status: false,
          message: 'Forbidden: Tidak dapat memindahkan lapangan ke cabang lain',
        });
        return;
      }

      // Force branchId to be user's branch from middleware
      updateData.branchId = branchId;
    }

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
        errors: result.error.format(),
      });
      return;
    }

    const updatedField = await prisma.field.update({
      where: { id: fieldId },
      data: result.data,
    });

    // Hapus cache yang relevan
    await invalidateFieldCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_FIELD',
        details: `Memperbarui lapangan "${updatedField.name}" (ID: ${fieldId}) di cabang ${existingField.branch.name}`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil memperbarui lapangan',
      data: updatedField,
    });
  } catch (error) {
    console.error('Error updating field:', error);

    // Clean up uploaded file if exists
    if (req.file?.path) {
      await cleanupUploadedFile(req.file.path);
    }

    res.status(500).json({
      status: false,
      message: 'Gagal memperbarui lapangan',
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
        message: 'Invalid field ID',
      });
      return;
    }

    // Get branch ID from middleware
    const branchId = req.userBranch?.id;

    if (!branchId) {
      res.status(400).json({
        status: false,
        message: 'Branch ID is required',
      });
      return;
    }

    // Super admin bisa menghapus lapangan manapun
    const whereCondition = req.user?.role === Role.SUPER_ADMIN ? { id: fieldId } : { id: fieldId, branchId };

    // Check if field exists and belongs to the user's branch
    const existingField = await prisma.field.findFirst({
      where: whereCondition,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!existingField) {
      res.status(404).json({
        status: false,
        message: 'Lapangan tidak ditemukan atau tidak berada dalam cabang Anda',
      });
      return;
    }

    // Check if field has any bookings
    const bookings = await prisma.booking.findFirst({
      where: { fieldId },
    });

    if (bookings) {
      res.status(400).json({
        status: false,
        message: 'Tidak dapat menghapus lapangan yang memiliki pemesanan',
      });
      return;
    }

    // Delete image from Cloudinary if exists
    if (existingField.imageUrl) {
      await cleanupUploadedFile(existingField.imageUrl);
    }

    // Delete field
    await prisma.field.delete({
      where: { id: fieldId },
    });

    // Hapus cache yang relevan
    await invalidateFieldCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_FIELD',
        details: `Menghapus lapangan "${existingField.name}" (ID: ${fieldId}) dari cabang ${existingField.branch.name}`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil menghapus lapangan',
    });
  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({
      status: false,
      message: 'Gagal menghapus lapangan',
    });
  }
};

// Get a single field by ID
export const getFieldById = async (req: Request, res: Response): Promise<void> => {
  if (res.headersSent) return;

  try {
    const { id } = req.params;
    const fieldId = parseInt(id);

    if (isNaN(fieldId)) {
      res.status(400).json({
        status: false,
        message: 'Invalid field ID',
      });
      return;
    }

    // Ini endpoint publik, tidak perlu cek branch
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        type: true,
      },
    });

    if (!field) {
      res.status(404).json({
        status: false,
        message: 'Lapangan tidak ditemukan',
      });
      return;
    }

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan data lapangan',
      data: field,
    });
  } catch (error) {
    console.error('Error getting field by ID:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};
