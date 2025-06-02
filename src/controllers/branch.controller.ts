import { Request, Response } from 'express';
import prisma from '../config/services/database';
import { branchSchema, updateBranchSchema } from '../zod-schemas/branch.schema';
import { invalidateBranchCache } from '../utils/cache/cacheInvalidation.utils';
import { MulterRequest } from '../middlewares/multer.middleware';
import { cleanupUploadedFile } from '../utils/cloudinary.utils';
import { User } from '../middlewares/auth.middleware';
import { BranchStatus, Role } from '../types';

/**
 * Unified Branch Controller
 * Menggabungkan fungsionalitas dari semua controller branch yang ada
 * dengan menggunakan middleware permission untuk kontrol akses
 */

export const getBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { q, page = '1', limit = '15' } = req.query;

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
          message: 'Cabang tidak ditemukan',
        });
        return;
      }

      res.status(200).json({
        status: true,
        message: 'Berhasil mendapatkan data cabang',
        data: branch,
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
        OR: [{ name: { contains: q as string } }, { location: { contains: q as string } }],
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
      message: 'Internal Server Error',
    });
  }
};

export const createBranch = async (req: MulterRequest & User, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod (tanpa imageUrl dulu)
    const result = branchSchema.safeParse({
      name: req.body.name,
      location: req.body.location,
      ownerId: parseInt(req.body.ownerId),
      status: req.body.status || ('active' as BranchStatus),
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
      data: newBranch,
    });
  } catch (error) {
    console.error('Error in createBranch:', error);
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

export const updateBranch = async (req: MulterRequest & User, res: Response): Promise<void> => {
  if (res.headersSent) return;

  try {
    const { id } = req.params;
    const branchId = parseInt(id);

    console.log('🔍 Update branch request:', {
      branchId,
      body: req.body,
      hasFile: !!req.file,
      fileName: req.file?.originalname
    });

    if (isNaN(branchId)) {
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
      status: req.body.status as BranchStatus,
      imageUrl: req.file?.path || undefined,
    };

    // Validasi data dengan Zod
    const result = updateBranchSchema.safeParse(dataToValidate);

    if (!result.success) {
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
    if (req.user?.role !== 'super_admin') {
      const isAuthorized = await prisma.branch.findFirst({
        where: {
          id: branchId,
          OR: [
            { ownerId: req.user!.id },
            {
              admins: {
                some: {
                  userId: req.user!.id,
                },
              },
            },
          ],
        },
      });

      if (!isAuthorized) {
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
    if (ownerId && req.user?.role === Role.SUPER_ADMIN) {
      (updateData as any).ownerId = ownerId;
    }

    // Handle image update logic
    let shouldCleanupOldImage = false;
    
    console.log('📸 Image handling - removeImage flag:', req.body.removeImage);
    console.log('📸 Image handling - has file:', !!req.file);
    console.log('📸 Image handling - keepCurrentImage:', req.body.keepCurrentImage);
    
    if (req.body.removeImage === 'true') {
      // User wants to remove the image - EXPLICITLY set to null
      console.log('📸 Removing image as requested');
      (updateData as any).imageUrl = null; // Force set to null
      shouldCleanupOldImage = true;
      
      // Clean up uploaded file if any (shouldn't happen but just in case)
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
    } else if (req.file?.path) {
      // New image is uploaded
      console.log('📸 New image uploaded:', req.file.originalname);
      updateData.imageUrl = req.file.path;
      shouldCleanupOldImage = true;
    } else if (req.body.keepCurrentImage === 'true') {
      // Keep current image - don't change imageUrl field at all
      console.log('📸 Keeping current image');
      delete updateData.imageUrl;
    } else {
      // No specific instruction - don't modify imageUrl
      console.log('📸 No image changes requested');
      delete updateData.imageUrl;
    }

    console.log('📝 Final update data:', {
      ...updateData,
      imageUrl: updateData.imageUrl === null ? 'WILL_BE_DELETED' : updateData.imageUrl ? 'SET' : 'UNCHANGED'
    });

    // IMPORTANT: Use spread operator to ensure null values are included
    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        ...updateData,
        // Explicitly handle imageUrl to ensure null is passed when removing
        ...(req.body.removeImage === 'true' ? { imageUrl: null } : {}),
      },
    });

    // Clean up old image if needed
    if (shouldCleanupOldImage && existingBranch.imageUrl) {
      console.log('🗑️ Cleaning up old image:', existingBranch.imageUrl);
      await cleanupUploadedFile(existingBranch.imageUrl);
    }

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

    console.log('✅ Branch updated successfully');

    res.status(200).json({
      status: true,
      message: 'Berhasil memperbarui cabang',
      data: updatedBranch,
    });
  } catch (error) {
    console.error('❌ Error updating branch:', error);

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

export const deleteBranch = async (req: User, res: Response): Promise<void> => {
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
      message: 'Internal Server Error',
    });
  }
};

/**
 * Mendapatkan cabang yang dimiliki atau dikelola oleh user yang sedang login
 */
export const getUserBranches = async (req: User, res: Response): Promise<void> => {
  try {
    const { q, page = '1', limit = '10' } = req.query;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    // Buat kondisi pencarian
    let whereCondition: any = {};
    
    // Filter berdasarkan peran pengguna
    if (userRole === Role.OWNER_CABANG) {
      // Jika owner cabang, ambil cabang yang dimiliki
      whereCondition.ownerId = userId;
    } else if (userRole === Role.ADMIN_CABANG) {
      // Jika admin cabang, ambil cabang yang dikelola
      whereCondition.admins = {
        some: {
          userId: userId
        }
      };
    } else if (userRole !== Role.SUPER_ADMIN) {
      // Jika bukan super admin, owner, atau admin cabang, user tidak memiliki cabang
      res.status(200).json({
        status: true,
        message: 'Berhasil mendapatkan daftar cabang',
        data: [],
        meta: {
          page: pageNumber,
          limit: limitNumber,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
      return;
    }
    
    // Tambahkan filter pencarian jika parameter q ada
    if (q) {
      whereCondition = {
        ...whereCondition,
        OR: [
          { name: { contains: q as string } }, 
          { location: { contains: q as string } }
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
        admins: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          }
        }
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
    console.error('Error in getUserBranches:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};

/**
 * Mendapatkan admin cabang berdasarkan ID pengguna
 */
export const getBranchAdminById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = parseInt(id);

    if (isNaN(adminId)) {
      res.status(400).json({
        status: false,
        message: 'Invalid request data',
      });
      return;
    }

    // Periksa apakah cabang ada
    const admin = await prisma.branch.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      res.status(404).json({
        status: false,
        message: 'Data admin tidak ditemukan',
      });
      return;
    }

    // Dapatkan admin cabang berdasarkan branchId dan userId
    const branchAdmin = await prisma.branchAdmin.findFirst({
      where: {
        userId: adminId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!branchAdmin) {
      res.status(404).json({
        status: false,
        message: 'Admin cabang tidak ditemukan',
      });
      return;
    }

    res.status(200).json(branchAdmin);
  } catch (error) {
    console.error('Error getting branch admin by ID:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
}

/**
 * Menambahkan Cabang Untuk Admin
 */
export const addBranchAdmin = async (req: User, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;
    const branchId = parseInt(id);
    const parsedUserId = parseInt(userId);

    if (isNaN(branchId) || isNaN(parsedUserId)) {
      res.status(400).json({
        status: false,
        message: 'Invalid request data',
      });
      return;
    }

    // Periksa apakah cabang ada
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

    // Periksa apakah pengguna yang dimaksud ada
    const user = await prisma.user.findUnique({
      where: { id: parsedUserId },
    });

    if (!user) {
      res.status(404).json({
        status: false,
        message: 'Pengguna tidak ditemukan',
      });
      return;
    }

    // Cek apakah pengguna sudah menjadi admin cabang
    const existingAdmin = await prisma.branchAdmin.findFirst({
      where: {
        branchId,
        userId: parsedUserId,
      },
    });

    if (existingAdmin) {
      res.status(400).json({
        status: false,
        message: `Pengguna sudah menjadi admin cabang ${branchId}`,
      });
      return;
    }

    // Tambahkan admin cabang baru
    await prisma.branchAdmin.upsert({
      where: {
        branchId_userId: {
          branchId,
          userId: parsedUserId,
        },
      },
      create: {
        branchId,
        userId: parsedUserId,
      },
      update: {},
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'ADD_BRANCH_ADMIN',
        details: `Menambahkan ${user.name} sebagai admin cabang "${branch.name}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: `Berhasil menambahkan ${user.name} sebagai admin cabang "${branch.name}"`,
    });
  } catch (error) {
    console.error('Error updating branch admin:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
}

/**
 * Hapus admin cabang
 */
export const deleteBranchAdmin = async (req: User, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;
    const branchId = parseInt(id);
    const parsedUserId = parseInt(userId);

    if (isNaN(branchId) || isNaN(parsedUserId)) {
      res.status(400).json({
        status: false,
        message: 'Invalid request data',
      });
      return;
    }

    // Periksa apakah cabang ada
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

    // Periksa apakah pengguna yang dimaksud ada
    const user = await prisma.user.findUnique({
      where: { id: parsedUserId },
    });

    if (!user) {
      res.status(404).json({
        status: false,
        message: 'Pengguna tidak ditemukan',
      });
      return;
    }

    // Hapus admin cabang
    await prisma.branchAdmin.delete({
      where: {
        branchId_userId: {
          branchId,
          userId: parsedUserId,
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'REMOVE_BRANCH_ADMIN',
        details: `Menghapus ${user.name} sebagai admin cabang "${branch.name}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: `Berhasil menghapus ${user.name} sebagai admin cabang "${branch.name}"`,
    });
  } catch (error) {
    console.error('Error deleting branch admin:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
}

/**
 * Mendapatkan daftar admin cabang berdasarkan ID cabang
 */
export const getBranchAdmins = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = parseInt(id);

    if (isNaN(branchId)) {
      res.status(400).json({
        status: false,
        message: 'ID cabang tidak valid',
      });
      return;
    }

    // Periksa apakah cabang ada
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

    // Dapatkan semua admin untuk cabang ini
    const branchAdmins = await prisma.branchAdmin.findMany({
      where: {
        branchId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan daftar admin cabang',
      data: branchAdmins,
    });
  } catch (error) {
    console.error('Error getting branch admins:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};