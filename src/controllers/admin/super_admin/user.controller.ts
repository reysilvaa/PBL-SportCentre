// src/controllers/superAdminUserController.ts
import { Request, Response } from 'express';
import prisma from '../../../config/services/database';
import { hashPassword } from '../../../utils/password.utils';
import { User } from '../../../middlewares/auth.middleware';
import { deleteCachedDataByPattern } from '../../../utils/cache.utils';

// Get all users without branch restrictions
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Daftar user berhasil diambil',
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal',
    });
  }
};

// Create user as super admin
export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    // Validasi data input
    if (!name || !email || !password) {
      res.status(400).json({
        status: false,
        message: 'Nama, email, dan password harus diisi',
      });
      return;
    }

    // Cek apakah email sudah digunakan
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        status: false,
        message: 'Email sudah digunakan',
      });
      return;
    }

    // Hash password sebelum menyimpan
    const hashedPassword = await hashPassword(password);

    // Buat user baru
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        phone: req.body.phone,
      },
    });

    // Hapus cache yang terkait user
    deleteCachedDataByPattern('users_');

    res.status(201).json({
      status: true,
      message: 'User berhasil dibuat',
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal',
    });
  }
};

// Update user as super admin
export const updateUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    // Cek apakah user ada
    const existingUser = await prisma.user.findUnique({
      where: { id: Number(id) },
    });

    if (!existingUser) {
      res.status(404).json({
        status: false,
        message: 'User tidak ditemukan',
      });
      return;
    }

    // Siapkan data untuk update
    const updateData: any = {};

    if (name) updateData.name = name;
    if (email) {
      // Cek apakah email baru sudah digunakan oleh user lain
      if (email !== existingUser.email) {
        const emailExists = await prisma.user.findFirst({
          where: {
            email,
            id: { not: Number(id) },
          },
        });

        if (emailExists) {
          res.status(400).json({
            status: false,
            message: 'Email sudah digunakan oleh pengguna lain',
          });
          return;
        }
      }
      updateData.email = email;
    }

    if (password) {
      // Hash password baru
      updateData.password = await hashPassword(password);
    }

    if (role) updateData.role = role;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
    });

    // Hapus cache yang terkait user
    deleteCachedDataByPattern('users_');

    // Hapus password dari response
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      status: true,
      message: 'User berhasil diperbarui',
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal',
    });
  }
};

// Delete user as super admin
export const deleteUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = Number(id);

    // Cek apakah user ada
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({
        status: false,
        message: 'User tidak ditemukan',
      });
      return;
    }

    // Cek apakah user memiliki booking aktif
    const activeBookings = await prisma.booking.findMany({
      where: {
        userId: userId,
        startTime: {
          gt: new Date(),
        },
      },
    });

    if (activeBookings.length > 0) {
      res.status(400).json({
        status: false,
        message: 'User memiliki booking aktif dan tidak dapat dihapus',
      });
      return;
    }

    // Cek apakah user memiliki cabang
    const ownedBranches = await prisma.branch.findMany({
      where: { ownerId: userId },
    });

    if (ownedBranches.length > 0) {
      res.status(400).json({
        status: false,
        message:
          'User memiliki cabang yang dikelola. Harap pindahkan kepemilikan cabang sebelum menghapus user ini.',
      });
      return;
    }

    // Gunakan Prisma transaction untuk menghapus semua relasi dan user
    await prisma.$transaction(async (tx: any) => {
      // 1. Hapus semua notifikasi user
      await tx.notification.deleteMany({
        where: { userId },
      });

      // 2. Hapus penggunaan promo
      await tx.promotionUsage.deleteMany({
        where: { userId },
      });

      // 3. Hapus review lapangan
      await tx.fieldReview.deleteMany({
        where: { userId },
      });

      // 4. Hapus log aktivitas
      await tx.activityLog.deleteMany({
        where: { userId },
      });

      // 5. Hapus pembayaran yang dibuat user
      await tx.payment.deleteMany({
        where: { userId },
      });

      // 6. Hapus booking user=
      // Hapus booking harus dilakukan setelah payment karena payment bergantung pada booking
      await tx.booking.deleteMany({
        where: { userId },
      });

      // 7. Akhirnya, hapus user
      await tx.user.delete({
        where: { id: userId },
      });
    });

    // Setelah berhasil delete
    // Hapus cache yang terkait user
    deleteCachedDataByPattern('users_');

    res.status(200).json({
      status: true,
      message: 'User berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting user:', error);

    // Berikan pesan error yang lebih spesifik
    let errorMessage = 'Terjadi kesalahan server internal';
    if (error instanceof Error) {
      if (error.message.includes('Foreign key constraint')) {
        errorMessage =
          'User tidak dapat dihapus karena masih memiliki data terkait di sistem';
      }
    }

    res.status(500).json({
      status: false,
      message: errorMessage,
    });
  }
};
