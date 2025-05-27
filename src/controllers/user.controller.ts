import { Response } from 'express';
import prisma from '../config/services/database';
import { hashPassword } from '../utils/password.utils';
import { invalidateUserCache } from '../utils/cache/cacheInvalidation.utils';
import { User as AuthUser } from '../middlewares/auth.middleware';
import { Role } from '../types';
/**
 * Unified User Controller
 * Menggabungkan fungsionalitas dari semua controller user yang ada
 * dengan menggunakan middleware permission untuk kontrol akses
 */

// =============== COMMON OPERATIONS =============== //

export const getUserProfile = async (req: AuthUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = parseInt(id) || req.user?.id;

    if (!userId) {
      res.status(400).json({
        status: false,
        message: 'User ID tidak valid',
      });
      return;
    }

    // Super admin dapat melihat profil user manapun
    // User biasa hanya dapat melihat profil mereka sendiri
    if (req.user?.role !== Role.SUPER_ADMIN && userId !== req.user?.id) {
      res.status(403).json({
        status: false,
        message: 'Anda tidak memiliki akses untuk melihat profil user ini',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        status: false,
        message: 'User tidak ditemukan',
      });
      return;
    }

    res.status(200).json({
      status: true,
      message: 'Profil user berhasil didapatkan',
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal',
    });
  }
};

export const updateUserProfile = async (req: AuthUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, phone, password } = req.body;
    const userId = parseInt(id) || req.user?.id;

    if (!userId) {
      res.status(400).json({
        status: false,
        message: 'User ID tidak valid',
      });
      return;
    }

    // Super admin dapat mengupdate profil user manapun
    // User biasa hanya dapat mengupdate profil mereka sendiri
    if (req.user?.role !== 'super_admin' && userId !== req.user?.id) {
      res.status(403).json({
        status: false,
        message: 'Anda tidak memiliki akses untuk mengupdate profil user ini',
      });
      return;
    }

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

    // Persiapkan data untuk update
    const updateData: any = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    if (email && email !== existingUser.email) {
      // Cek apakah email baru sudah digunakan oleh user lain
      const emailExists = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId },
        },
      });

      if (emailExists) {
        res.status(400).json({
          status: false,
          message: 'Email sudah digunakan oleh pengguna lain',
        });
        return;
      }

      updateData.email = email;
    }

    if (password) {
      // Hash password baru
      updateData.password = await hashPassword(password);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Hapus cache yang terkait user
    await invalidateUserCache(userId);

    // Hapus password dari response
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.status(200).json({
      status: true,
      message: 'Profil user berhasil diperbarui',
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal',
    });
  }
};

// =============== SUPER ADMIN OPERATIONS =============== //

export const getUsers = async (req: AuthUser, res: Response): Promise<void> => {
  try {
    // Jika user adalah super admin, tampilkan semua user
    if (req.user?.role === 'super_admin') {
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
      return;
    }

    // Jika user adalah admin cabang, tampilkan user yang terkait dengan cabang
    const branchId = req.userBranch?.id;

    if (!branchId) {
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
          branchId,
        },
      },
      include: {
        user: true,
      },
      distinct: ['userId'],
    });

    // Ambil user unik dari bookings
    const uniqueUsers = Array.from(
      new Map(bookings.map((booking: { userId: number; user: any }) => [booking.userId, booking.user])).values()
    );

    res.status(200).json({
      status: true,
      message: 'Daftar user berhasil didapatkan',
      data: uniqueUsers.map((user) => {
        // Hapus password dari response
        const { _password, ...userWithoutPassword } = user as {
          password: string;
          [key: string]: any;
        };
        return {
          ...userWithoutPassword,
          branch: req.userBranch?.name,
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

export const createUser = async (req: AuthUser, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, phone, branchId } = req.body;

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

    // Validasi peran berdasarkan role pengguna yang membuat
    let allowedRoles = ['user'];

    if (req.user?.role === 'super_admin') {
      allowedRoles = ['user', 'admin_cabang', 'owner_cabang', 'super_admin'];
    } else if (req.user?.role === 'admin_cabang' || req.user?.role === 'owner_cabang') {
      allowedRoles = ['user', 'admin_cabang'];
    }

    if (role && !allowedRoles.includes(role)) {
      res.status(400).json({
        status: false,
        message: `Peran yang diizinkan hanya ${allowedRoles.join(', ')}`,
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
        role: role || 'user', // Default ke role 'user'
        phone,
      },
    });

    // Jika admin cabang membuat user dan role adalah admin_cabang, buat relasi dengan cabang
    if (
      (req.user?.role === 'admin_cabang' || req.user?.role === 'owner_cabang') && role === 'admin_cabang' && branchId
    ) {
      await prisma.branchAdmin.create({
        data: {
          branchId: branchId,
          userId: newUser.id,
        },
      });
    }

    // Tambahkan log aktivitas
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_USER',
        details: `Membuat user baru "${name}" dengan role ${role || 'user'}`,
        ipAddress: req.ip || undefined,
      },
    });

    // Hapus cache yang terkait user
    await invalidateUserCache();

    // Hapus password dari response
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      status: true,
      message: 'User berhasil dibuat',
      data: {
        ...userWithoutPassword,
        branch: req.userBranch?.name,
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

export const updateUser = async (req: AuthUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, password, role, phone } = req.body;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({
        status: false,
        message: 'ID user tidak valid',
      });
      return;
    }

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

    // Validasi peran berdasarkan role pengguna yang mengupdate
    if (role && req.user?.role !== 'super_admin') {
      let allowedRoles = ['user'];

      if (req.user?.role === 'admin_cabang' || req.user?.role === 'owner_cabang') {
        allowedRoles = ['user', 'admin_cabang'];
      }

      if (!allowedRoles.includes(role)) {
        res.status(400).json({
          status: false,
          message: `Peran yang diizinkan hanya ${allowedRoles.join(', ')}`,
        });
        return;
      }
    }

    // Siapkan data untuk update
    const updateData: any = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    if (email && email !== existingUser.email) {
      // Cek apakah email baru sudah digunakan oleh user lain
      const emailExists = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId },
        },
      });

      if (emailExists) {
        res.status(400).json({
          status: false,
          message: 'Email sudah digunakan oleh pengguna lain',
        });
        return;
      }

      updateData.email = email;
    }

    if (password) {
      // Hash password baru
      updateData.password = await hashPassword(password);
    }

    if (role && req.user?.role === 'super_admin') {
      updateData.role = role;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Hapus cache yang terkait user
    await invalidateUserCache(userId);

    // Tambahkan log aktivitas
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_USER',
        details: `Memperbarui user "${existingUser.name}" (ID: ${userId})`,
        ipAddress: req.ip || undefined,
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

export const deleteUser = async (req: AuthUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({
        status: false,
        message: 'ID user tidak valid',
      });
      return;
    }

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

    // Super admin dapat menghapus user manapun kecuali dirinya sendiri
    // Admin cabang hanya dapat menghapus user reguler terkait cabangnya
    if (req.user?.role !== 'super_admin') {
      // Jika bukan superadmin, cek batasan lain
      if (existingUser.role !== 'user') {
        res.status(403).json({
          status: false,
          message: 'Anda hanya dapat menghapus user reguler',
        });
        return;
      }

      // Admin cabang hanya dapat menghapus user yang terkait dengan cabangnya
      const branchId = req.userBranch?.id;

      if (!branchId) {
        res.status(403).json({
          status: false,
          message: 'Admin tidak terhubung dengan cabang manapun',
        });
        return;
      }

      // Cek apakah user memiliki booking di cabang ini
      const userBookings = await prisma.booking.findFirst({
        where: {
          userId,
          field: {
            branchId,
          },
        },
      });

      if (!userBookings) {
        res.status(403).json({
          status: false,
          message: 'User ini tidak terkait dengan cabang Anda',
        });
        return;
      }
    }

    // Cek jika user mencoba menghapus dirinya sendiri
    if (userId === req.user?.id) {
      res.status(400).json({
        status: false,
        message: 'Anda tidak dapat menghapus akun Anda sendiri',
      });
      return;
    }

    // Cek apakah user yang akan dihapus memiliki bookings
    const userBookings = await prisma.booking.findFirst({
      where: { userId },
    });

    if (userBookings) {
      res.status(400).json({
        status: false,
        message: 'Tidak dapat menghapus user yang memiliki booking',
      });
      return;
    }

    // Hapus relasi branchAdmin jika ada
    await prisma.branchAdmin.deleteMany({
      where: { userId },
    });

    // Hapus user
    await prisma.user.delete({
      where: { id: userId },
    });

    // Hapus cache yang terkait user
    await invalidateUserCache(userId);

    // Tambahkan log aktivitas
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_USER',
        details: `Menghapus user "${existingUser.name}" (ID: ${userId})`,
        ipAddress: req.ip || undefined,
      },
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

/**
 * Mendapatkan daftar admin dari cabang-cabang yang dimiliki/dikelola oleh user yang login
 */
export const getUserBranchAdmins = async (req: AuthUser, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { q } = req.query;

    let branchIds: number[] = [];

    // Dapatkan cabang berdasarkan peran
    if (userRole === Role.SUPER_ADMIN) {
      // Super admin bisa melihat semua admin cabang
      const allBranches = await prisma.branch.findMany({
        select: { id: true }
      });
      branchIds = allBranches.map(branch => branch.id);
    } else if (userRole === Role.OWNER_CABANG) {
      // Owner mendapatkan cabang yang dimiliki
      const ownedBranches = await prisma.branch.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
      branchIds = ownedBranches.map(branch => branch.id);
    } else if (userRole === Role.ADMIN_CABANG) {
      // Admin mendapatkan cabang yang dikelola
      const managedBranches = await prisma.branchAdmin.findMany({
        where: { userId: userId },
        select: { branchId: true }
      });
      branchIds = managedBranches.map(admin => admin.branchId);
    } else {
      // User biasa tidak memiliki cabang
      res.status(200).json({
        status: true,
        message: 'Berhasil mendapatkan daftar admin cabang',
        data: []
      });
      return;
    }

    if (branchIds.length === 0) {
      res.status(200).json({
        status: true,
        message: 'Berhasil mendapatkan daftar admin cabang',
        data: []
      });
      return;
    }

    // Dapatkan semua admin cabang
    let branchAdmins = await prisma.branchAdmin.findMany({
      where: {
        branchId: { in: branchIds }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
    });

    // Filter berdasarkan query pencarian jika ada
    if (q) {
      const searchQuery = q as string;
      branchAdmins = branchAdmins.filter(admin => 
        admin.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.branch.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    res.status(200).json({
      status: true,
      message: 'Berhasil mendapatkan daftar admin cabang',
      data: branchAdmins
    });
  } catch (error) {
    console.error('Error getting branch admins:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal'
    });
  }
};

/**
 * Mendapatkan cabang untuk admin berdasarkan ID user
 */
export const getUserBranches = async (req: AuthUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({
        status: false,
        message: 'ID user tidak valid',
      });
      return;
    }

    // Cek apakah user ada dan role-nya admin_cabang
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        status: false,
        message: 'User tidak ditemukan',
      });
      return;
    }

    if (user.role !== 'admin_cabang') {
      res.status(400).json({
        status: false,
        message: 'User bukan admin cabang',
      });
      return;
    }

    // Ambil data branch admin
    const branchAdmins = await prisma.branchAdmin.findMany({
      where: { userId },
      include: {
        branch: true,
      },
    });

    res.status(200).json({
      status: true,
      message: 'Data cabang berhasil diambil',
      data: branchAdmins,
    });
  } catch (error) {
    console.error('Error getting user branches:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal',
    });
  }
};

/**
 * Mendapatkan profil admin berdasarkan ID
 */
export const getAdminProfile = async (req: AuthUser, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({
        status: false,
        message: 'ID user tidak valid',
      });
      return;
    }

    // Cek apakah user ada
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        status: false,
        message: 'User tidak ditemukan',
      });
      return;
    }

    res.status(200).json({
      status: true,
      message: 'Profil user berhasil didapatkan',
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user profile by ID:', error);
    res.status(500).json({
      status: false,
      message: 'Terjadi kesalahan server internal',
    });
  }
}
