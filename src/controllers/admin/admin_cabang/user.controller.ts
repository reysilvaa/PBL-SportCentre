// src/controllers/branchAdminUserController.ts
import { Response } from 'express';
import prisma from '../../../config/services/database';
import { hashPassword } from '../../../utils/password.utils';
import { User } from '../../../middlewares/auth.middleware';

// Renamed from document 3, this stays basically the same since branch admin
// functionality is already working as expected
export const getUsers = async (req: User, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;

    // Dapatkan cabang yang dimiliki admin
    const branch = await prisma.branch.findFirst({
      where: {
        ownerId: adminId,
      },
    });

    if (!branch) {
      res.status(403).json({
        status: false,
        message: 'Admin tidak terhubung dengan cabang manapun',
      });
      return;
    }

    // Dapatkan booking terkait dengan branch ini untuk mendapatkan user-user yang terkait
    const bookings = await prisma.booking.findMany({
      where: {
        field: {
          branchId: branch.id,
        },
      },
      include: {
        user: true,
      },
      distinct: ['userId'],
    });

    // Ambil user unik dari bookings
    const uniqueUsers = Array.from(
      new Map(
        bookings.map((booking: { userId: number; user: any }) => [
          booking.userId,
          booking.user,
        ]),
      ).values(),
    );

    res.json({
      status: true,
      message: 'Daftar user berhasil didapatkan',
      data: uniqueUsers.map((user) => {
        // Hapus password dari response
        const { password, ...userWithoutPassword } = user as {
          password: string;
          [key: string]: any;
        };
        return {
          ...userWithoutPassword,
          branch: branch.name,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal',
    });
  }
};

export const createUser = async (req: User, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    const adminId = req.user?.id;

    // Dapatkan cabang yang dimiliki admin
    const branch = await prisma.branch.findFirst({
      where: {
        ownerId: adminId,
      },
    });

    if (!branch) {
      res.status(403).json({
        status: false,
        message: 'Admin tidak terhubung dengan cabang manapun',
      });
      return;
    }

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
        message: 'Email sudah digunakan oleh pengguna lain',
      });
      return;
    }

    // Validasi peran yang diizinkan
    const allowedRoles = ['user', 'admin_cabang'];
    if (role && !allowedRoles.includes(role)) {
      res.status(400).json({
        status: false,
        message: 'Peran yang diizinkan hanya user atau admin_cabang',
      });
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Buat user baru
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'user', // Default ke role 'user'
      },
    });

    // Tambahkan log aktivitas untuk menandai user ini dibuat oleh admin
    await prisma.activityLog.create({
      data: {
        userId: newUser.id,
        action: 'USER_CREATED',
        details: `User dibuat oleh admin cabang ${branch.name}`,
      },
    });

    // Hapus password dari response
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      status: true,
      message: 'User berhasil dibuat',
      data: {
        ...userWithoutPassword,
        branch: branch.name,
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

export const updateUser = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;
    const adminId = req.user?.id;

    // Dapatkan cabang yang dimiliki admin
    const branch = await prisma.branch.findFirst({
      where: {
        ownerId: adminId,
      },
    });

    if (!branch) {
      res.status(403).json({
        status: false,
        message: 'Admin tidak terhubung dengan cabang manapun',
      });
      return;
    }

    // Cek apakah user yang akan diupdate ada
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

    // Cek apakah user pernah melakukan booking di branch ini
    const userBooking = await prisma.booking.findFirst({
      where: {
        userId: Number(id),
        field: {
          branchId: branch.id,
        },
      },
    });

    if (!userBooking && existingUser.id !== adminId) {
      res.status(403).json({
        status: false,
        message:
          'Anda hanya dapat mengelola user yang telah melakukan booking di cabang Anda',
      });
      return;
    }

    // Validasi peran yang diizinkan
    const allowedRoles = ['user', 'admin_cabang'];
    if (role && !allowedRoles.includes(role)) {
      res.status(400).json({
        status: false,
        message: 'Peran yang diizinkan hanya user atau admin_cabang',
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

    // Tambahkan log aktivitas
    await prisma.activityLog.create({
      data: {
        userId: updatedUser.id,
        action: 'USER_UPDATED',
        details: `User diperbarui oleh admin cabang ${branch.name}`,
      },
    });

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

export const deleteUser = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    // Dapatkan cabang yang dimiliki admin
    const branch = await prisma.branch.findFirst({
      where: {
        ownerId: adminId,
      },
    });

    if (!branch) {
      res.status(403).json({
        status: false,
        message: 'Admin tidak terhubung dengan cabang manapun',
      });
      return;
    }

    // Cek apakah user yang akan dihapus ada
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

    // Cek apakah user pernah melakukan booking di branch ini
    const userBooking = await prisma.booking.findFirst({
      where: {
        userId: Number(id),
        field: {
          branchId: branch.id,
        },
      },
    });

    if (!userBooking && existingUser.id !== adminId) {
      res.status(403).json({
        status: false,
        message:
          'Anda hanya dapat mengelola user yang telah melakukan booking di cabang Anda',
      });
      return;
    }

    // Cegah menghapus diri sendiri
    if (existingUser.id === adminId) {
      res.status(400).json({
        status: false,
        message: 'Anda tidak dapat menghapus akun Anda sendiri',
      });
      return;
    }

    // Cek jika user memiliki booking aktif
    const activeBookings = await prisma.booking.findMany({
      where: {
        userId: Number(id),
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

    // Hapus user
    await prisma.user.delete({
      where: { id: Number(id) },
    });

    res.status(200).json({
      status: true,
      message: 'User berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal',
    });
  }
};
