import prisma from '../../config/services/database';
import { Decimal } from '@prisma/client/runtime/library';
import { 
  startOfMonth, endOfMonth, startOfDay, endOfDay, 
  startOfYear, endOfYear, subMonths, subYears, format 
} from 'date-fns';
import { id } from 'date-fns/locale';
import { PaymentStatus } from '../../types';

// Tipe periode untuk filter
export type PeriodType = 'daily' | 'monthly' | 'yearly';

// Struktur data untuk respons statistik
export interface DashboardStats {
  [key: string]: any;
}

/**
 * Service terpadu untuk statistik yang bisa digunakan oleh dashboard dan booking
 */

/**
 * Mendapatkan range waktu berdasarkan periode yang dipilih
 */
export const getTimeRange = (period: PeriodType) => {
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
export const getSuperAdminStats = async (timeRange: any): Promise<DashboardStats> => {
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
export const getOwnerCabangStats = async (userId: number, timeRange: any): Promise<DashboardStats> => {
  // Hanya menggunakan variabel yang benar-benar digunakan
  const { start, end, interval, pastPeriods, formatFn } = timeRange;

  // Mendapatkan semua cabang yang dimiliki oleh owner
  const branches = await prisma.branch.findMany({
    where: {
      ownerId: userId,
    },
    include: {
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

  // Mendapatkan semua admin dengan query langsung untuk mendapatkan data lengkap
  const branchIds = branches.map(branch => branch.id);
  
  // Query admin berdasarkan branchIds
  const branchAdminsWithDetails = await prisma.branchAdmin.findMany({
    where: {
      branchId: {
        in: branchIds
      }
    },
    include: {
      user: true,
      branch: true
    }
  });

  // Menghitung total cabang
  const totalBranches = branches.length;

  // Menghitung total admin di semua cabang
  const totalAdmins = branchAdminsWithDetails.length;

  // Data untuk analisis booking dan pendapatan
  let totalIncome = new Decimal(0);
  let totalBookings = 0;
  const bookingsByDate: Record<string, number> = {};
  const incomeByDate: Record<string, number> = {};

  // Proses semua booking untuk mendapatkan statistik real
  branches.forEach((branch) => {
    branch.Fields.forEach((field) => {
      field.Bookings.forEach((booking) => {
        totalBookings++;
        
        // Mendapatkan tanggal booking
        let dateKey;
        const bookingDate = new Date(booking.bookingDate);
        
        if (interval === 'hour') {
          // Format jam: "HH:00"
          dateKey = `${bookingDate.getHours().toString().padStart(2, '0')}:00`;
        } else if (interval === 'year') {
          // Format tahun: "YYYY"
          dateKey = bookingDate.getFullYear().toString();
        } else {
          // Format bulan: gunakan formatFn
          dateKey = formatFn(bookingDate);
        }
        
        // Hitung booking per periode
        bookingsByDate[dateKey] = (bookingsByDate[dateKey] || 0) + 1;

        // Hitung pendapatan jika booking sudah dibayar
        if (booking.payment && booking.payment.status === 'paid') {
          const amount = Number(booking.payment.amount);
          totalIncome = totalIncome.plus(amount);
          incomeByDate[dateKey] = (incomeByDate[dateKey] || 0) + amount;
        }
      });
    });
  });

  // Generate data untuk grafik pendapatan dan booking berdasarkan data real
  const revenueData = {
    categories: [] as string[],
    series: [] as number[],
  };

  const bookingData = {
    categories: [] as string[],
    series: [] as number[],
  };

  // Buat kategori berdasarkan interval
  let categories: string[] = [];
  
  if (interval === 'hour') {
    // Kategori per jam (06:00 - 23:00)
    categories = Array.from({ length: 18 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);
  } else if (interval === 'year') {
    // Kategori per tahun (6 tahun terakhir)
    const currentYear = new Date().getFullYear();
    categories = Array.from({ length: pastPeriods }, (_, i) => (currentYear - pastPeriods + i + 1).toString());
  } else {
    // Kategori per bulan
    categories = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  }
  
  // Isi data berdasarkan kategori
  revenueData.categories = categories;
  bookingData.categories = categories;
  
  // Isi series dengan data real atau 0 jika tidak ada
  revenueData.series = categories.map(cat => incomeByDate[cat] || 0);
  bookingData.series = categories.map(cat => bookingsByDate[cat] || 0);

  // Format data cabang untuk tampilan tabel
  const branchesData = branches.map((branch) => {
    // Hitung jumlah admin untuk cabang ini
    const adminCount = branchAdminsWithDetails.filter(admin => admin.branchId === branch.id).length;
    
    return {
      id: branch.id.toString(),
      name: branch.name,
      location: branch.location,
      status: branch.status.toLowerCase(),
      adminCount: adminCount,
      fieldCount: branch.Fields.length,
    };
  });

  // Format data admin untuk tampilan tabel dengan data yang lebih lengkap
  const adminsData = branchAdminsWithDetails.map((admin) => {
    // Format data admin sesuai dengan schema dan kebutuhan tampilan
    return {
      id: admin.userId.toString(),
      name: admin.user.name,
      email: admin.user.email,
      phone: admin.user.phone || 'N/A', // phone bisa null dalam schema
      branch: admin.branch.name,
      // Status sesuai dengan cabang
      status: admin.branch.status.toLowerCase() === 'active' ? 'active' : 'inactive',
      // Role dari user (ubah format sesuai yang diinginkan frontend)
      role: formatRole(admin.user.role),
      // Format tanggal
      lastActive: formatDate(admin.user.createdAt),
    };
  });

  return {
    totalBranches,
    totalAdmins,
    totalIncome: Number(totalIncome),
    totalBookings,
    revenueData,
    bookingData,
    branches: branchesData,
    admins: adminsData,
  };
};

// Helper functions untuk format data
function formatRole(role: any): string {
  // Format role agar lebih user friendly
  switch(role) {
    case 'admin_cabang':
      return 'Admin Cabang';
    case 'owner_cabang':
      return 'Owner Cabang';
    case 'super_admin':
      return 'Super Admin';
    case 'user':
      return 'User';
    default:
      return role;
  }
}

function formatDate(date: any): string {
  if (!date) return 'N/A';
  // Format: DD-MM-YYYY HH:MM
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, '0')}-${
    (d.getMonth() + 1).toString().padStart(2, '0')
  }-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${
    d.getMinutes().toString().padStart(2, '0')
  }`;
}

/**
 * Mendapatkan statistik untuk Admin Cabang
 */
export const getAdminCabangStats = async (userId: number, timeRange: any): Promise<DashboardStats> => {
  const { start, end, interval, pastPeriods } = timeRange;

  // Dapatkan branch admin
  const branchAdmin = await prisma.branchAdmin.findFirst({
    where: {
      userId,
    },
  });

  if (!branchAdmin) {
    throw new Error('Branch admin not found');
  }

  const branchId = branchAdmin.branchId;

  // Mendapatkan data branch dan field
  const branch = await prisma.branch.findUnique({
    where: {
      id: branchId,
    },
    include: {
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
              user: true,
            },
          },
        },
      },
    },
  });

  if (!branch) {
    throw new Error('Branch not found');
  }

  // Menghitung jumlah booking
  let totalBookings = 0;
  let pendingPayments = 0;
  let totalIncome = new Decimal(0);
  let bookingsPerDay: Record<string, number> = {};
  let incomePerDay: Record<string, number> = {};
  let customerBookingCounts: Record<string, { count: number; user: any }> = {};

  // Menghitung field yang tersedia (tidak dibooking) untuk hari ini
  const availableFields = branch.Fields.filter((field) => {
    const fieldBookingsToday = field.Bookings.filter(
      (booking) => new Date(booking.bookingDate).toDateString() === new Date().toDateString()
    );
    return fieldBookingsToday.length === 0;
  }).length;

  branch.Fields.forEach((field) => {
    field.Bookings.forEach((booking) => {
      totalBookings++;

      // Menghitung pembayaran pending
      if (booking.payment && booking.payment.status === PaymentStatus.PENDING) {
        pendingPayments++;
      }

      // Menghitung total pendapatan dari booking yang sudah dibayar
      if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
        totalIncome = totalIncome.plus(booking.payment.amount);
      }

      // Mengelompokkan booking berdasarkan tanggal untuk grafik
      const bookingDate = new Date(booking.bookingDate).toISOString().split('T')[0];
      bookingsPerDay[bookingDate] = (bookingsPerDay[bookingDate] || 0) + 1;

      // Mengelompokkan pendapatan berdasarkan tanggal untuk grafik
      if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
        incomePerDay[bookingDate] = (incomePerDay[bookingDate] || 0) + Number(booking.payment.amount);
      }

      // Mengelompokkan booking berdasarkan customer untuk top customers
      if (booking.user) {
        const userId = booking.user.id.toString();
        if (!customerBookingCounts[userId]) {
          customerBookingCounts[userId] = {
            count: 0,
            user: booking.user,
          };
        }
        customerBookingCounts[userId].count++;
      }
    });
  });

  // Generate data untuk grafik (contoh implementasi sederhana)
  const bookingData = {
    categories: [] as string[],
    series: [] as number[],
  };

  const incomeData = {
    categories: [] as string[],
    series: [] as number[],
  };

  // Kategori grafik (tanggal/hari/bulan)
  if (interval === 'hour') {
    // Untuk periode harian (jam)
    const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
    bookingData.categories = hours;
    bookingData.series = [4, 6, 8, 5, 7, 9, 4];
    
    incomeData.categories = hours;
    incomeData.series = [200000, 300000, 400000, 250000, 350000, 450000, 200000];
  } else if (interval === 'year') {
    // Untuk periode tahunan
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: pastPeriods }, (_, i) => (currentYear - pastPeriods + i + 1).toString());
    
    bookingData.categories = years;
    bookingData.series = [420, 380, 450, 520, 480, 350];
    
    incomeData.categories = years;
    incomeData.series = [15000000, 12000000, 16000000, 18000000, 17000000, 14000000];
  } else {
    // Default: periode bulanan
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    
    bookingData.categories = months;
    bookingData.series = [28, 35, 30, 25, 32, 38, 30, 26, 34, 40, 29, 36];
    
    incomeData.categories = months;
    incomeData.series = [800000, 950000, 900000, 750000, 850000, 1000000, 850000, 780000, 880000, 1100000, 820000, 950000];
  }

  // Top customers sorted by booking count
  const topCustomers = Object.values(customerBookingCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((item) => ({
      id: item.user.id.toString(),
      name: item.user.name,
      email: item.user.email,
      phone: item.user.phone || 'N/A',
      bookingCount: item.count,
    }));

  return {
    totalBookings,
    pendingPayments,
    totalIncome: Number(totalIncome),
    availableFields,
    bookingData,
    incomeData,
    topCustomers,
  };
};

/**
 * Mendapatkan statistik untuk User
 */
export const getUserStats = async (userId: number, timeRange: any): Promise<DashboardStats> => {
  const { start, end } = timeRange;

  // Mendapatkan semua booking user
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      bookingDate: {
        gte: start,
        lte: end,
      },
    },
    include: {
      field: {
        include: {
          branch: true,
          type: true,
        },
      },
      payment: true,
    },
    orderBy: {
      bookingDate: 'desc',
    },
  });

  // Menghitung jumlah booking aktif (yang belum lewat tanggalnya)
  const today = new Date();
  const activeBookings = bookings.filter(
    (booking) => new Date(booking.bookingDate) >= today
  ).length;

  // Menghitung jumlah booking selesai
  const completedBookings = bookings.filter(
    (booking) => new Date(booking.bookingDate) < today
  ).length;

  // Mendapatkan lapangan favorit
  const fieldCounts: Record<string, { count: number; name: string }> = {};
  bookings.forEach((booking) => {
    const fieldId = booking.field.id.toString();
    if (!fieldCounts[fieldId]) {
      fieldCounts[fieldId] = { count: 0, name: booking.field.name };
    }
    fieldCounts[fieldId].count++;
  });

  // Mendapatkan lapangan dengan jumlah booking terbanyak
  let favoriteField = 'Belum ada';
  let maxBookings = 0;
  Object.entries(fieldCounts).forEach(([_, { count, name }]) => {
    if (count > maxBookings) {
      maxBookings = count;
      favoriteField = name;
    }
  });

  // Mendapatkan jumlah notifikasi belum dibaca
  const unreadNotifications = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  // Data untuk grafik aktivitas
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  
  const activityData = {
    categories: monthNames,
    series: [4, 6, 8, 10, 7, 9, 5, 8, 10, 12, 8, 6],
  };

  // Mendapatkan booking terbaru untuk ditampilkan
  const recentBookings = bookings.slice(0, 5).map((booking) => ({
    id: booking.id.toString(),
    fieldName: booking.field.name,
    branchName: booking.field.branch.name,
    date: new Date(booking.bookingDate).toLocaleDateString('id-ID'),
    time: `${new Date(booking.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${new Date(booking.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
    status: new Date(booking.bookingDate) >= today ? 'active' : 'completed',
    paymentStatus: booking.payment?.status || 'pending',
  }));

  return {
    activeBookings,
    completedBookings,
    favoriteField,
    unreadNotifications,
    activityData,
    recentBookings,
  };
};

/**
 * Mendapatkan statistik booking untuk semua cabang (untuk SuperAdmin)
 */
export const getBookingStats = async () => {
  const stats = await prisma.$transaction(async (prisma) => {
    // Total bookings
    const totalBookings = await prisma.booking.count();

    // Bookings by status
    const bookingsByStatus = await prisma.payment.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    // Bookings by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookingsByDate = await prisma.booking.groupBy({
      by: ['bookingDate'],
      where: {
        bookingDate: {
          gte: thirtyDaysAgo,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        bookingDate: 'asc',
      },
    });

    // Revenue by branch
    const revenueByBranch = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAID,
      },
      select: {
        amount: true,
        booking: {
          select: {
            field: {
              select: {
                branch: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const branchRevenue = revenueByBranch.reduce(
      (acc, payment) => {
        const branchId = payment.booking?.field?.branch?.id;
        const branchName = payment.booking?.field?.branch?.name;

        if (branchId && branchName) {
          if (!acc[branchId]) {
            acc[branchId] = { id: branchId, name: branchName, total: 0 };
          }
          acc[branchId].total += Number(payment.amount);
        }
        return acc;
      },
      {} as Record<number, { id: number; name: string; total: number }>
    );

    return {
      totalBookings,
      bookingsByStatus: bookingsByStatus.map((item) => ({
        status: item.status,
        count: item._count.id,
      })),
      bookingsByDate: bookingsByDate.map((item) => ({
        date: item.bookingDate,
        count: item._count.id,
      })),
      revenueByBranch: Object.values(branchRevenue),
    };
  });

  return stats;
}; 