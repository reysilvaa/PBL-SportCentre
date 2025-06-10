import { Request, Response } from 'express';
import prisma from '../config/services/database';
import { createFieldReviewSchema, updateFieldReviewSchema } from '../zod-schemas/fieldReview.schema';
import { invalidateFieldReviewCache } from '../utils/cache/cacheInvalidation.utils';
import { User } from '../middlewares/auth.middleware';
import { Role, PaymentStatus } from '../types';

/**
 * Unified Field Review Controller
 * Mengelola endpoint terkait ulasan lapangan
 */

export const getFieldReviews = async (req: Request, res: Response) => {
  try {
    const { fieldId, userId } = req.query;

    // Filtering berdasarkan query params
    const whereCondition: any = {};

    if (fieldId) {
      whereCondition.fieldId = parseInt(fieldId as string);
    }

    if (userId) {
      whereCondition.userId = parseInt(userId as string);
    }

    const reviews = await prisma.fieldReview.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        field: {
          select: {
            id: true,
            name: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan data ulasan lapangan',
      data: reviews,
    });
  } catch (error) {
    console.error('Error fetching field reviews:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};

export const createFieldReview = async (req: User, res: Response): Promise<void> => {
  try {
    const { fieldId } = req.params;

    // Validasi data dengan Zod dan pastikan userId adalah pengguna saat ini
    const result = createFieldReviewSchema.safeParse({
      ...req.body,
      userId: req.user?.id,
      fieldId: parseInt(fieldId),
    });

    if (!result.success) {
      res.status(400).json({  
        status: false,
        message: 'Validasi gagal',
        errors: result.error.format(),
      });
      return;
    }

    const { userId, fieldId: parsedFieldId, rating, review } = result.data;

    // Cek apakah lapangan ada
    const field = await prisma.field.findUnique({
      where: { id: parsedFieldId },
      select: { name: true, branchId: true },
    });

    if (!field) {
      res.status(404).json({
        status: false,
        message: 'Lapangan tidak ditemukan',
      });
      return;
    }

    // Cek apakah user pernah booking lapangan ini (opsional)
    const userBooking = await prisma.booking.findFirst({
      where: {
        userId,
        fieldId: parsedFieldId,
        payments: {
          some: {
            status: PaymentStatus.PAID,
          },
        },
      },
    });

    if (!userBooking) {
      res.status(400).json({
        status: false,
        message: 'Anda harus melakukan booking terlebih dahulu untuk memberikan ulasan',
      });
      return;
    }

    // Cek apakah user sudah pernah memberi ulasan
    const existingReview = await prisma.fieldReview.findFirst({
      where: {
        userId,
        fieldId: parsedFieldId,
      },
    });

    if (existingReview) {
      res.status(400).json({
        status: false,
        message: 'Anda sudah memberikan ulasan untuk lapangan ini',
      });
      return;
    }

    // Buat ulasan baru
    const newReview = await prisma.fieldReview.create({
      data: {
        userId,
        fieldId: parsedFieldId,
        rating,
        review,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        field: {
          select: {
            name: true,
          },
        },
      },
    });

    // Hapus cache field reviews
    await invalidateFieldReviewCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE_FIELD_REVIEW',
        details: `Memberikan ulasan untuk lapangan "${field.name}" dengan rating ${rating}`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(201).json({
      status: true,
      message: 'Berhasil membuat ulasan lapangan',
      data: newReview,
    });
  } catch (error) {
    console.error('Error creating field review:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};

export const updateFieldReview = async (req: User, res: Response) => {
  try {
    const { id } = req.params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      res.status(400).json({
        status: false,
        message: 'ID ulasan tidak valid',
      });
      return;
    }

    // Cek apakah ulasan ada dan milik user yang sama
    const existingReview = await prisma.fieldReview.findUnique({
      where: { id: reviewId },
      include: {
        field: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!existingReview) {
      res.status(404).json({
        status: false,
        message: 'Ulasan tidak ditemukan',
      });
      return;
    }

    // Pastikan hanya pemilik ulasan yang bisa mengubahnya
    if (existingReview.userId !== req.user?.id && req.user?.role !== Role.SUPER_ADMIN) {
      res.status(403).json({
        status: false,
        message: 'Anda tidak memiliki izin untuk mengubah ulasan ini',
      });
      return;
    }

    // Validasi data dengan Zod
    const result = updateFieldReviewSchema.safeParse({
      ...req.body,
      userId: existingReview.userId, // Pastikan userId tidak berubah
    });

    if (!result.success) {
      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        errors: result.error.format(),
      });
      return;
    }

    const updatedReview = await prisma.fieldReview.update({
      where: { id: reviewId },
      data: {
        rating: result.data.rating,
        review: result.data.review,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        field: {
          select: {
            name: true,
          },
        },
      },
    });

    // Hapus cache field reviews
    await invalidateFieldReviewCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_FIELD_REVIEW',
        details: `Memperbarui ulasan untuk lapangan "${existingReview.field.name}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil memperbarui ulasan lapangan',
      data: updatedReview,
    });
  } catch (error) {
    console.error('Error updating field review:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};

export const deleteFieldReview = async (req: User, res: Response) => {
  try {
    const { id } = req.params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      res.status(400).json({
        status: false,
        message: 'ID ulasan tidak valid',
      });
      return;
    }

    // Cek apakah ulasan ada
    const existingReview = await prisma.fieldReview.findUnique({
      where: { id: reviewId },
      include: {
        field: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!existingReview) {
      res.status(404).json({
        status: false,
        message: 'Ulasan tidak ditemukan',
      });
      return;
    }

    // Pastikan hanya pemilik ulasan atau admin yang bisa menghapusnya
    if (existingReview.userId !== req.user?.id && req.user?.role !== Role.SUPER_ADMIN) {
      res.status(403).json({
        status: false,
        message: 'Anda tidak memiliki izin untuk menghapus ulasan ini',
      });
      return;
    }

    await prisma.fieldReview.delete({
      where: { id: reviewId },
    });

    // Hapus cache field reviews
    await invalidateFieldReviewCache();

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_FIELD_REVIEW',
        details: `Menghapus ulasan untuk lapangan "${existingReview.field.name}"`,
        ipAddress: req.ip || undefined,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Berhasil menghapus ulasan lapangan',
    });
  } catch (error) {
    console.error('Error deleting field review:', error);
    res.status(500).json({
      status: false,
      message: 'Internal Server Error',
    });
  }
};
