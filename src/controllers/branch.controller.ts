import { Request, Response } from 'express';
import prisma from '../config/services/database';
import {
  branchSchema,
  updateBranchSchema,
} from '../zod-schemas/branch.schema';
import { invalidateBranchCache } from '../utils/cache/cacheInvalidation.utils';
import { MulterRequest } from '../middlewares/multer.middleware';
import { cleanupUploadedFile } from '../utils/cloudinary.utils';
import { User } from '../middlewares/auth.middleware';
import { deleteCachedDataByPattern } from '../utils/cache.utils';

/**
 * Unified Branch Controller
 * Menggabungkan fungsionalitas dari semua controller branch yang ada
 * dengan menggunakan middleware permission untuk kontrol akses
 */

// Constants for folder paths
const BRANCH_FOLDER = 'PBL/branch-images';

export const getBranches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { q, page = '1', limit = '10' } = req.query;

    if (id) {
      // Jika ID disediakan, ambil cabang spesifik
      const branch = await prisma.branch.findUnique({
        where: { id: parseInt(id) },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!branch) {
        res.status(404).json({ 
          status: false,
          message: 'Cabang tidak ditemukan' 
        });
        return;
      }

      res.status(200).json({
        status: true,
        message: 'Berhasil mendapatkan data cabang',
        data: branch
      });
      return;
    }

    // Jika tidak ada ID, ambil semua cabang dengan filter dan paginasi
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    // Buat kondisi pencarian jika parameter q ada
    let whereCondition = {};
    if (q) {
      whereCondition = {
        OR: [
          { name: { contains: q as string } },
          { location: { contains: q as string } },
        ],
      };
    }

    // Hitung total data
    const totalItems = await prisma.branch.count({
      where: whereCondition,
    });

    // Ambil data dengan paginasi dan pencarian
    const branches = await prisma.branch.findMany({
      where: whereCondition,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      skip,
      take: limitNumber,
    });

    const totalPages = Math.ceil(totalItems / limitNumber);

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan daftar cabang',
      data: branches,
      meta: {
        page: pageNumber,
        limit: limitNumber,
        totalItems,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error('Error in getBranches:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
};

export const createBranch = async (
  req: MulterRequest & User,
  res: Response
): Promise<void> => {
  try {
    // Validasi data dengan Zod (tanpa imageUrl dulu)
    const result = branchSchema.safeParse({
      name: req.body.name,
      location: req.body.location,
      ownerId: parseInt(req.body.ownerId),
      status: req.body.status || 'active',
    });

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

    // Tambahkan data cabang dengan imageUrl secara terpisah
    const branchData = {
      ...result.data,
      imageUrl: req.file?.path || null,
    };
    
    const newBranch = await prisma.branch.create({
      data: branchData,
    });

    // Hapus cache secara komprehensif
    await invalidateBranchCache(newBranch.id);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_BRANCH',
        details: `Membuat cabang baru "${branchData.name}" dengan owner ID ${branchData.ownerId}`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(201).json({
      status: true,
      message: 'Berhasil membuat cabang baru',
      data: newBranch
    });
  } catch (error) {
    console.error('Error in createBranch:', error);
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

export const updateBranch = async (
  req: MulterRequest & User,
  res: Response
): Promise<void> => {
  if (res.headersSent) return;

  try {
    const { id } = req.params;
    const branchId = parseInt(id);

    if (isNaN(branchId)) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }

      res.status(400).json({
        status: false,
        message: 'Invalid branch ID',
      });
      return;
    }

    // Periksa apakah cabang ada
    const existingBranch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!existingBranch) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }

      res.status(404).json({
        status: false,
        message: 'Cabang tidak ditemukan',
      });
      return;
    }

    // Persiapkan data untuk validasi
    const dataToValidate = {
      name: req.body.name,
      location: req.body.location,
      status: req.body.status,
      imageUrl: req.file?.path || undefined,
    };

    // Validasi data dengan Zod
    const result = updateBranchSchema.safeParse(dataToValidate);

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

    // Pemeriksaan ownerId
    let ownerId: number | undefined;
    if (req.body.ownerId) {
      ownerId = parseInt(req.body.ownerId);
    }

    // Validasi apakah pengguna memiliki akses ke cabang ini
    // Super admin dapat memperbarui cabang mana pun
    if (req.user?.role !== 'super_admin') {
      const isAuthorized = await prisma.branch.findFirst({
        where: {
          id: branchId,
          OR: [
            { ownerId: req.user!.id }, // User is owner
            { 
              admins: {
                some: {
                  userId: req.user!.id,
                },
              },
            }, // User is admin
          ],
        },
      });

      if (!isAuthorized) {
        // Clean up uploaded file if exists
        if (req.file?.path) {
          await cleanupUploadedFile(req.file.path);
        }

        res.status(403).json({
          status: false,
          message: 'Anda tidak memiliki akses untuk mengubah cabang ini',
        });
        return;
      }

      // Admin cabang dan pemilik cabang tidak dapat mengubah ownerId
      if (ownerId && ownerId !== existingBranch.ownerId) {
        // Clean up uploaded file if exists
        if (req.file?.path) {
          await cleanupUploadedFile(req.file.path);
        }

        res.status(403).json({
          status: false,
          message: 'Anda tidak dapat mengubah pemilik cabang',
        });
        return;
      }
    }

    // Prepare update data
    const updateData = { ...result.data };
    
    // Tambahkan ownerId jika ada dan izinkan (untuk superadmin)
    if (ownerId && req.user?.role === 'super_admin') {
      (updateData as any).ownerId = ownerId;
    }

    // Handle image update
    if (req.file?.path) {
      updateData.imageUrl = req.file.path;
      
      // Clean up old image if exists
      if (existingBranch.imageUrl) {
        await cleanupUploadedFile(existingBranch.imageUrl);
      }
    }

    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: updateData,
    });

    // Hapus cache secara komprehensif
    await invalidateBranchCache(branchId);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_BRANCH',
        details: `Mengupdate cabang "${existingBranch.name}" menjadi "${updateData.name || existingBranch.name}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil memperbarui cabang',
      data: updatedBranch,
    });
  } catch (error) {
    console.error('Error updating branch:', error);
    
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

export const deleteBranch = async (
  req: User,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = parseInt(id);

    if (isNaN(branchId)) {
      res.status(400).json({
        status: false,
        message: 'Invalid branch ID',
      });
      return;
    }

    // Cek apakah cabang ada
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

    // Cek apakah cabang memiliki lapangan
    const fields = await prisma.field.findFirst({
      where: { branchId: branchId },
    });

    if (fields) {
      res.status(400).json({
        status: false,
        message: 'Tidak dapat menghapus cabang yang memiliki lapangan',
      });
      return;
    }

    // Cek apakah cabang memiliki admin
    const branchAdmins = await prisma.branchAdmin.findFirst({
      where: { branchId: branchId },
    });

    if (branchAdmins) {
      res.status(400).json({
        status: false,
        message: 'Tidak dapat menghapus cabang yang memiliki admin',
      });
      return;
    }

    // Hapus gambar cabang jika ada
    if (branch.imageUrl) {
      await cleanupUploadedFile(branch.imageUrl);
    }

    // Hapus cabang
    await prisma.branch.delete({
      where: { id: branchId },
    });

    // Hapus cache secara komprehensif
    await invalidateBranchCache(branchId);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_BRANCH',
        details: `Menghapus cabang "${branch.name}" (ID: ${branchId})`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil menghapus cabang',
    });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
}; 