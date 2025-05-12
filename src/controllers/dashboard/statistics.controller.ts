import { Request, Response } from 'express';
import prisma from '../../config/services/database';
import { Decimal } from '@prisma/client/runtime/library';
import { Role } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfDay, endOfDay, startOfYear, endOfYear, subMonths, subYears, format } from 'date-fns';
import { id } from 'date-fns/locale';

// Deklarasi tambahan untuk extend tipe Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: string;
      };
    }
  }
}

// Struktur data untuk respons statistik
interface DashboardStats {
  [key: string]: any;
}

// Tipe periode untuk filter
type PeriodType = 'daily' | 'monthly' | 'yearly';

/**
 * Controller untuk mendapatkan statistik dashboard berdasarkan role dan periode
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'monthly' } = req.query as { period?: PeriodType };
    const role = req.user?.role as Role;
    const userId = req.user?.id;

    if (!role || !userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Mendapatkan rentang waktu berdasarkan periode
    const timeRange = getTimeRange(period);

    // Mendapatkan statistik berdasarkan role
    let stats: DashboardStats;

    switch (role) {
      case 'super_admin':
        stats = await getSuperAdminStats(timeRange);
        break;
      case 'owner_cabang':
        stats = await getOwnerCabangStats(userId, timeRange);
        break;
      case 'admin_cabang':
        stats = await getAdminCabangStats(userId, timeRange);
        break;
      case 'user':
        stats = await getUserStats(userId, timeRange);
        break;
      default:
        res.status(400).json({ message: 'Role tidak valid' });
        return;
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil statistik dashboard' });
  }
};

/**
 * Mendapatkan range waktu berdasarkan periode yang dipilih
 */
const getTimeRange = (period: PeriodType) => {
  const now = new Date();

  switch (period) {
    case 'daily':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
        previous: {
          start: startOfDay(new Date(now.setDate(now.getDate() - 1))),
          end: endOfDay(new Date(now.setDate(now.getDate() - 1))),
        },
        formatFn: (date: Date) => format(date, 'HH:mm', { locale: id }),
        interval: 'hour',
        pastPeriods: 7, // 7 hari terakhir
      };
    case 'yearly':
      return {
        start: startOfYear(now),
        end: endOfYear(now),
        previous: {
          start: startOfYear(subYears(now, 1)),
          end: endOfYear(subYears(now, 1)),
        },
        formatFn: (date: Date) => format(date, 'yyyy', { locale: id }),
        interval: 'year',
        pastPeriods: 6, // 6 tahun terakhir
      };
    case 'monthly':
    default:
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
        previous: {
          start: startOfMonth(subMonths(now, 1)),
          end: endOfMonth(subMonths(now, 1)),
        },
        formatFn: (date: Date) => format(date, 'MMM', { locale: id }),
        interval: 'month',
        pastPeriods: 12, // 12 bulan terakhir
      };
  }
};

/**
 * Mendapatkan statistik untuk Super Admin
 */
const getSuperAdminStats = async (timeRange: any): Promise<DashboardStats> => {
  const { start, end } = timeRange;

  // Menghitung total cabang
  const totalBranches = await prisma.branch.count({
    where: {
      createdAt: { lte: end },
    },
  });

  // Menghitung total pengguna
  const totalUsers = await prisma.user.count({
    where: {
      createdAt: { lte: end },
    },
  });

  // Menghitung total lapangan
  const totalFields = await prisma.field.count({
    where: {
      createdAt: { lte: end },
    },
  });

  // Menghitung promosi aktif
  const activePromotions = await prisma.promotion.count({
    where: {
      status: 'active',
      validFrom: { lte: end },
      validUntil: { gte: start },
    },
  });

  // Mendapatkan distribusi cabang berdasarkan region (dari lokasi)
  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      admins: {
        select: {
          userId: true,
        },
      },
      Fields: {
        select: {
          id: true,
        },
      },
    },
  });

  // Menghitung jumlah branch berdasarkan region
  // Asumsikan region/provinsi ada di akhir string lokasi (e.g., "Jakarta, Indonesia")
  const regionCounts: Record<string, number> = {};
  
  branches.forEach(branch => {
    const locationParts = branch.location.split(',');
    const region = locationParts.length > 1 
      ? locationParts[locationParts.length - 2].trim() 
      : locationParts[0].trim();
    
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  });

  // Konversi ke format yang diinginkan untuk frontend
  const regions = Object.entries(regionCounts)
    .map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / totalBranches) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 4); // Ambil 4 region teratas

  // Format data untuk tampilan tabel
  const branchesData = branches.map(branch => ({
    id: branch.id.toString(),
    name: branch.name,
    location: branch.location,
    status: branch.status.toLowerCase(),
    adminCount: branch.admins.length,
    fieldCount: branch.Fields.length,
  }));

  return {
    totalBranches,
    totalUsers,
    totalFields,
    activePromotions,
    regions,
    branches: branchesData,
  };
};

/**
 * Mendapatkan statistik untuk Owner Cabang
 */
const getOwnerCabangStats = async (userId: number, timeRange: any): Promise<DashboardStats> => {
  // Hanya menggunakan variabel yang benar-benar digunakan
  const { start, end, interval, pastPeriods } = timeRange;

  // Mendapatkan semua cabang yang dimiliki oleh owner
  const branches = await prisma.branch.findMany({
    where: {
      ownerId: userId,
    },
    include: {
      admins: true,
      Fields: {
        include: {
          Bookings: {
            where: {
              bookingDate: {
                gte: start,
                lte: end,
              },
            },
            include: {
              payment: true,
            },
          },
        },
      },
    },
  });

  // Menghitung total cabang
  const totalBranches = branches.length;

  // Menghitung total admin di semua cabang
  const totalAdmins = branches.reduce((sum: number, branch: any) => sum + branch.admins.length, 0);

  // Menghitung total pendapatan dari semua booking yang sudah dibayar di periode ini
  let totalIncome = new Decimal(0);
  let totalBookings = 0;

  branches.forEach((branch: any) => {
    branch.Fields.forEach((field: any) => {
      field.Bookings.forEach((booking: any) => {
        totalBookings++;
        if (booking.payment && booking.payment.status === 'paid') {
          totalIncome = totalIncome.plus(booking.payment.amount);
        }
      });
    });
  });

  // Data untuk grafik pendapatan dan booking per periode waktu
  const generateChartData = async () => {
    // Generate data untuk grafik pendapatan
    const revenueData = {
      categories: [] as string[],
      series: [] as number[],
    };

    // Generate data untuk grafik booking
    const bookingData = {
      categories: [] as string[],
      series: [] as number[],
    };

    // Generate time series data berdasarkan interval (jam, bulan, tahun)
    // Implementasi sederhana untuk contoh
    if (interval === 'hour') {
      // Implementasi untuk periode harian (per jam)
      const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      revenueData.categories = hours;
      revenueData.series = [580000, 420000, 350000, 450000, 600000, 850000, 900000];
      
      bookingData.categories = hours;
      bookingData.series = [12, 8, 9, 11, 15, 28, 32];
    } else if (interval === 'year') {
      // Implementasi untuk periode tahunan
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: pastPeriods }, (_, i) => (currentYear - pastPeriods + i + 1).toString());
      
      revenueData.categories = years;
      revenueData.series = [28000000, 25000000, 18000000, 32000000, 42000000, 15000000];
      
      bookingData.categories = years;
      bookingData.series = [850, 720, 680, 920, 1100, 450];
    } else {
      // Default: periode bulanan
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      
      revenueData.categories = months;
      revenueData.series = [3200000, 4500000, 3800000, 4200000, 4800000, 5200000, 5500000, 5800000, 6200000, 5900000, 6500000, 7200000];
      
      bookingData.categories = months;
      bookingData.series = [85, 120, 95, 105, 115, 130, 135, 150, 160, 145, 165, 180];
    }

    return { revenueData, bookingData };
  };

  const { revenueData, bookingData } = await generateChartData();

  // Format data untuk tampilan tabel cabang
  const branchesData = branches.map((branch: any) => ({
    id: branch.id.toString(),
    name: branch.name,
    location: branch.location,
    status: branch.status.toLowerCase(),
    adminCount: branch.admins.length,
    fieldCount: branch.Fields.length,
  }));

  // Mendapatkan data admin cabang
  const branchIds = branches.map((branch: any) => branch.id);
  
  // Mendapatkan admin untuk semua cabang milik owner
  const admins = await prisma.branchAdmin.findMany({
    where: {
      branchId: {
        in: branchIds,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          ActivityLogs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Format data admin untuk tampilan di frontend
  const adminsData = admins.map(admin => {
    const lastActive = admin.user.ActivityLogs.length > 0
      ? formatLastActive(admin.user.ActivityLogs[0].createdAt)
      : 'Belum aktif';

    return {
      id: admin.user.id.toString(),
      name: admin.user.name,
      email: admin.user.email,
      phone: admin.user.phone || '-',
      branch: admin.branch.name,
      status: 'active', // Asumsi default, bisa ditambahkan status user jika ada
      role: 'Admin Cabang',
      lastActive,
    };
  });

  return {
    totalBranches,
    totalAdmins,
    totalIncome: totalIncome.toNumber(),
    totalBookings,
    revenueData,
    bookingData,
    branches: branchesData,
    admins: adminsData,
  };
};

/**
 * Mendapatkan statistik untuk Admin Cabang
 */
const getAdminCabangStats = async (userId: number, timeRange: any): Promise<DashboardStats> => {
  const { start, end } = timeRange;

  // Mendapatkan cabang yang dikelola oleh admin
  const branchAdmins = await prisma.branchAdmin.findMany({
    where: {
      userId,
    },
    include: {
      branch: {
        include: {
          Fields: true,
        },
      },
    },
  });

  if (branchAdmins.length === 0) {
    return {
      totalBookings: 0,
      pendingPayments: 0,
      totalIncome: 0,
      availableFields: 0,
    };
  }

  // Mengambil semua cabang yang dikelola admin
  const branchIds = branchAdmins.map(ba => ba.branchId);

  // Mengambil semua lapangan dari cabang tersebut
  const fields = await prisma.field.findMany({
    where: {
      branchId: {
        in: branchIds,
      },
    },
    include: {
      Bookings: {
        where: {
          bookingDate: {
            gte: start,
            lte: end,
          },
        },
        include: {
          payment: true,
        },
      },
    },
  });

  // Menghitung jumlah booking
  let totalBookings = 0;
  let pendingPayments = 0;
  let totalIncome = new Decimal(0);

  fields.forEach(field => {
    totalBookings += field.Bookings.length;

    field.Bookings.forEach(booking => {
      if (booking.payment) {
        if (booking.payment.status === 'pending') {
          pendingPayments++;
        } else if (booking.payment.status === 'paid') {
          totalIncome = totalIncome.plus(booking.payment.amount);
        }
      }
    });
  });

  // Menghitung jumlah lapangan yang tersedia
  const availableFields = fields.filter(field => field.status === 'available').length;

  // Mendapatkan 5 pelanggan teratas
  const topCustomers = await prisma.booking.groupBy({
    by: ['userId'],
    where: {
      fieldId: {
        in: fields.map(f => f.id),
      },
      bookingDate: {
        gte: start,
        lte: end,
      },
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: 5,
  });

  // Mendapatkan detail user untuk pelanggan teratas
  const userIds = topCustomers.map(tc => tc.userId);
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  });

  const topCustomersWithDetails = topCustomers.map(tc => {
    const user = users.find(u => u.id === tc.userId);
    return {
      id: tc.userId.toString(),
      name: user?.name || 'Unknown',
      email: user?.email || 'Unknown',
      phone: user?.phone || '-',
      bookingCount: tc._count.id,
    };
  });

  return {
    totalBookings,
    pendingPayments,
    totalIncome: totalIncome.toNumber(),
    availableFields,
    topCustomers: topCustomersWithDetails,
  };
};

/**
 * Mendapatkan statistik untuk User biasa
 */
const getUserStats = async (userId: number, _timeRange: any): Promise<DashboardStats> => {
  // Tidak menggunakan start dan end, jadi kita beri awalan underscore pada parameter

  // Mendapatkan booking aktif (future dates)
  const now = new Date();
  const activeBookings = await prisma.booking.count({
    where: {
      userId,
      bookingDate: {
        gte: now,
      },
    },
  });

  // Mendapatkan booking yang sudah selesai
  const completedBookings = await prisma.booking.count({
    where: {
      userId,
      bookingDate: {
        lt: now,
      },
    },
  });

  // Mendapatkan field favorit (most booked)
  const favoriteFieldData = await prisma.booking.groupBy({
    by: ['fieldId'],
    where: {
      userId,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: 1,
  });

  let favoriteField = 'Belum ada';
  
  if (favoriteFieldData.length > 0) {
    const field = await prisma.field.findUnique({
      where: {
        id: favoriteFieldData[0].fieldId,
      },
      select: {
        name: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    });
    
    if (field) {
      favoriteField = `${field.name} - ${field.branch.name}`;
    }
  }

  // Mendapatkan jumlah notifikasi yang belum dibaca
  const unreadNotifications = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  // Mendapatkan data booking untuk user
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
    },
    orderBy: {
      bookingDate: 'desc',
    },
    take: 5, // Ambil 5 booking terbaru
    include: {
      field: {
        include: {
          branch: true,
        },
      },
      payment: true,
    },
  });

  // Format data booking untuk tampilan
  const recentBookings = bookings.map(booking => {
    const isActive = new Date(booking.bookingDate) >= now;
    const statusText = isActive ? 'Aktif' : 'Selesai';
    const paymentStatus = booking.payment ? booking.payment.status : 'pending';

    return {
      id: booking.id.toString(),
      fieldName: booking.field.name,
      branchName: booking.field.branch.name,
      date: format(new Date(booking.bookingDate), 'dd MMM yyyy', { locale: id }),
      time: `${format(new Date(booking.startTime), 'HH:mm')} - ${format(new Date(booking.endTime), 'HH:mm')}`,
      status: statusText,
      paymentStatus,
    };
  });

  return {
    activeBookings,
    completedBookings,
    favoriteField,
    unreadNotifications,
    recentBookings,
  };
};

/**
 * Format waktu terakhir aktif
 */
const formatLastActive = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Baru saja';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} menit lalu`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} jam lalu`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} hari lalu`;
  }
}; 