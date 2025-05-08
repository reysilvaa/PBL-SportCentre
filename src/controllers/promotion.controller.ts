import { Request, Response } from 'express';
import prisma from '../config/services/database';
import { invalidatePromotionCache } from '../utils/cache/cacheInvalidation.utils';
import { User } from '../middlewares/auth.middleware';

/**
 * Unified Promotion Controller
 * Mengelola endpoint terkait promosi dan diskon
 */

export const getPromotions = async (req: Request, res: Response) => {
  try {
    const promotions = await prisma.promotion.findMany({
      include: {
        PromoUsages: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan daftar promo',
      data: promotions
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
};

export const createPromotion = async (req: User, res: Response) => {
  try {
    const {
      code,
      description,
      discountPercent,
      maxDiscount,
      validFrom,
      validUntil,
      status,
    } = req.body;

    // Validasi data dasar
    if (!code || !description || !discountPercent) {
      res.status(400).json({
        status: false,
        message: 'Kode, deskripsi, dan persentase diskon harus diisi',
      });
      return;
    }

    // Cek apakah kode promo sudah ada
    const existingPromo = await prisma.promotion.findFirst({
      where: { code },
    });

    if (existingPromo) {
      res.status(400).json({
        status: false,
        message: 'Kode promo sudah digunakan',
      });
      return;
    }

    const newPromotion = await prisma.promotion.create({
      data: {
        code,
        description,
        discountPercent,
        maxDiscount,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        status: status || 'active',
      },
    });

    // Hapus cache promotions
    await invalidatePromotionCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_PROMOTION',
        details: `Membuat promo "${code}" dengan diskon ${discountPercent}%`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(201).json({
      status: true,
      message: 'Berhasil membuat promo baru',
      data: newPromotion
    });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
};

export const updatePromotion = async (req: User, res: Response) => {
  try {
    const { id } = req.params;
    const promoId = parseInt(id);
    
    if (isNaN(promoId)) {
      res.status(400).json({
        status: false,
        message: 'ID promo tidak valid',
      });
      return;
    }

    const {
      code,
      description,
      discountPercent,
      maxDiscount,
      validFrom,
      validUntil,
      status,
    } = req.body;

    // Cek apakah promo ada
    const existingPromo = await prisma.promotion.findUnique({
      where: { id: promoId },
    });

    if (!existingPromo) {
      res.status(404).json({
        status: false,
        message: 'Promo tidak ditemukan',
      });
      return;
    }

    // Validasi kode promo jika diubah
    if (code && code !== existingPromo.code) {
      const codeExists = await prisma.promotion.findFirst({
        where: { 
          code,
          id: { not: promoId }
        },
      });

      if (codeExists) {
        res.status(400).json({
          status: false,
          message: 'Kode promo sudah digunakan',
        });
        return;
      }
    }

    const updatedPromotion = await prisma.promotion.update({
      where: { id: promoId },
      data: {
        code: code || existingPromo.code,
        description: description || existingPromo.description,
        discountPercent: discountPercent || existingPromo.discountPercent,
        maxDiscount: maxDiscount || existingPromo.maxDiscount,
        validFrom: validFrom ? new Date(validFrom) : existingPromo.validFrom,
        validUntil: validUntil ? new Date(validUntil) : existingPromo.validUntil,
        status: status || existingPromo.status,
      },
    });

    // Hapus cache promotions
    await invalidatePromotionCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_PROMOTION',
        details: `Memperbarui promo "${existingPromo.code}" menjadi "${code || existingPromo.code}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil memperbarui promo',
      data: updatedPromotion
    });
  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
};

export const deletePromotion = async (req: User, res: Response) => {
  try {
    const { id } = req.params;
    const promoId = parseInt(id);
    
    if (isNaN(promoId)) {
      res.status(400).json({
        status: false,
        message: 'ID promo tidak valid',
      });
      return;
    }

    // Cek apakah promo ada
    const existingPromo = await prisma.promotion.findUnique({
      where: { id: promoId },
    });

    if (!existingPromo) {
      res.status(404).json({
        status: false,
        message: 'Promo tidak ditemukan',
      });
      return;
    }

    // Cek apakah promo sudah digunakan
    const usages = await prisma.promotionUsage.findFirst({
      where: { promoId },
    });

    if (usages) {
      res.status(400).json({
        status: false,
        message: 'Tidak dapat menghapus promo yang sudah digunakan',
      });
      return;
    }

    await prisma.promotion.delete({
      where: { id: promoId },
    });

    // Hapus cache promotions
    await invalidatePromotionCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_PROMOTION',
        details: `Menghapus promo "${existingPromo.code}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil menghapus promo'
    });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error' 
    });
  }
}; 