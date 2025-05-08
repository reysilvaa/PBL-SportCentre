import { Request, Response } from 'express';
import prisma from '../config/services/database';
import { User } from '../middlewares/auth.middleware';

/**
 * Unified Promotion Usage Controller
 * Mengelola endpoint terkait penggunaan promosi
 */

export const getPromotionUsages = async (req: User, res: Response) => {
  try {
    const { userId, promoId, bookingId } = req.query;

    // Filtering berdasarkan query params
    const whereCondition: any = {};

    if (userId) {
      whereCondition.userId = parseInt(userId as string);
    }

    if (promoId) {
      whereCondition.promoId = parseInt(promoId as string);
    }

    if (bookingId) {
      whereCondition.bookingId = parseInt(bookingId as string);
    }

    // Admin cabang dan owner hanya dapat melihat penggunaan promo terkait cabang mereka
    if (req.user?.role !== 'super_admin' && req.userBranch?.id) {
      whereCondition.booking = {
        field: {
          branchId: req.userBranch.id,
        },
      };
    }

    const usages = await prisma.promotionUsage.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        booking: {
          include: {
            field: {
              select: {
                name: true,
                branch: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        promo: true,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan data penggunaan promo',
      data: usages,
    });
  } catch (error) {
    console.error('Error fetching promotion usages:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};

export const createPromotionUsage = async (req: User, res: Response): Promise<void> => {
  try {
    const { bookingId, promoId } = req.body;
    const userId = req.user?.id;

    // Validasi data
    if (!userId || !bookingId || !promoId) {
      res.status(400).json({
        status: false,
        message: 'User ID, booking ID dan promo ID harus diisi',
      });
      return;
    }

    // Periksa apakah booking ada dan milik user yang sama
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
    });

    if (!booking) {
      res.status(404).json({
        status: false,
        message: 'Booking tidak ditemukan atau bukan milik Anda',
      });
      return;
    }

    // Periksa apakah promo valid
    const promotion = await prisma.promotion.findUnique({
      where: { id: promoId },
    });

    if (!promotion || promotion.status !== 'active') {
      res.status(400).json({
        status: false,
        message: 'Promo tidak valid atau tidak aktif',
      });
      return;
    }

    // Periksa apakah promo masih berlaku
    const now = new Date();
    if (now < promotion.validFrom || (promotion.validUntil && now > promotion.validUntil)) {
      res.status(400).json({
        status: false,
        message: 'Promo sudah tidak berlaku',
      });
      return;
    }

    // Periksa apakah promo sudah digunakan untuk booking ini
    const existingUsage = await prisma.promotionUsage.findFirst({
      where: { bookingId },
    });

    if (existingUsage) {
      res.status(400).json({
        status: false,
        message: 'Booking ini sudah menggunakan promo lain',
      });
      return;
    }

    // Buat penggunaan promo baru
    const newPromotionUsage = await prisma.promotionUsage.create({
      data: { userId, bookingId, promoId },
      include: {
        promo: true,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'USE_PROMOTION',
        details: `Menggunakan promo "${promotion.code}" untuk booking ID ${bookingId}`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(201).json({
      status: true,
      message: 'Berhasil menggunakan promo',
      data: newPromotionUsage,
    });
  } catch (error) {
    console.error('Error creating promotion usage:', error);
    res.status(400).json({
      status: false,
      message: 'Gagal menggunakan promo',
    });
  }
};

export const deletePromotionUsage = async (req: User, res: Response) => {
  try {
    const { id } = req.params;
    const usageId = parseInt(id);

    if (isNaN(usageId)) {
      res.status(400).json({
        status: false,
        message: 'ID penggunaan promo tidak valid',
      });
      return;
    }

    // Cek apakah promotion usage ada
    const usage = await prisma.promotionUsage.findUnique({
      where: { id: usageId },
      include: {
        booking: true,
        promo: true,
      },
    });

    if (!usage) {
      res.status(404).json({
        status: false,
        message: 'Penggunaan promo tidak ditemukan',
      });
      return;
    }

    // Cek kepemilikan (hanya pemilik atau admin yang bisa menghapus)
    if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin_cabang' && usage.userId !== req.user?.id) {
      res.status(403).json({
        status: false,
        message: 'Anda tidak memiliki izin untuk menghapus penggunaan promo ini',
      });
      return;
    }

    await prisma.promotionUsage.delete({
      where: { id: usageId },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_PROMOTION_USAGE',
        details: `Menghapus penggunaan promo "${usage.promo.code}" dari booking ID ${usage.bookingId}`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil menghapus penggunaan promo',
    });
  } catch (error) {
    console.error('Error deleting promotion usage:', error);
    res.status(400).json({
      status: false,
      message: 'Gagal menghapus penggunaan promo',
    });
  }
};
