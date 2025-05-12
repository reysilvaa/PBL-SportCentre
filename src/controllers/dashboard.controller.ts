import { Request, Response } from 'express';
import prisma from '../config/services/database';
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
    if (interval === 'hour') {
      // Implementasi untuk periode harian (per jam)
      const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      revenueData.categories = hours;
      bookingData.categories = hours;
      
      // Array untuk menyimpan data per jam
      const revenueByHour = Array(hours.length).fill(0);
      const bookingsByHour = Array(hours.length).fill(0);
      
      // Mengumpulkan data booking dan pendapatan per jam
      branches.forEach((branch: any) => {
        branch.Fields.forEach((field: any) => {
          field.Bookings.forEach((booking: any) => {
            const bookingHour = new Date(booking.bookingDate).getHours();
            // Mendapatkan indeks jam yang sesuai
            const hourIndex = Math.floor((bookingHour - 6) / 2); // 6 AM - 8 PM dengan interval 2 jam
            
            if (hourIndex >= 0 && hourIndex < hours.length) {
              bookingsByHour[hourIndex]++;
              
              if (booking.payment && booking.payment.status === 'paid') {
                revenueByHour[hourIndex] += Number(booking.payment.amount);
              }
            }
          });
        });
      });
      
      revenueData.series = revenueByHour;
      bookingData.series = bookingsByHour;
    } else if (interval === 'year') {
      // Implementasi untuk periode tahunan
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: pastPeriods }, (_, i) => (currentYear - pastPeriods + i + 1).toString());
      
      revenueData.categories = years;
      bookingData.categories = years;
      
      // Array untuk menyimpan data per tahun
      const revenueByYear = Array(years.length).fill(0);
      const bookingsByYear = Array(years.length).fill(0);
      
      // Mendapatkan seluruh booking dalam rentang waktu beberapa tahun terakhir
      const allBookings = await prisma.booking.findMany({
        where: {
          bookingDate: {
            gte: new Date(parseInt(years[0]), 0, 1), // 1 Jan tahun pertama
            lte: new Date(currentYear, 11, 31), // 31 Des tahun saat ini
          },
          field: {
            branchId: {
              in: branches.map((b: any) => b.id),
            },
          },
        },
        include: {
          payment: true,
        },
      });
      
      // Mengumpulkan data booking dan pendapatan per tahun
      allBookings.forEach(booking => {
        const bookingYear = new Date(booking.bookingDate).getFullYear().toString();
        const yearIndex = years.indexOf(bookingYear);
        
        if (yearIndex !== -1) {
          bookingsByYear[yearIndex]++;
          
          if (booking.payment && booking.payment.status === 'paid') {
            revenueByYear[yearIndex] += Number(booking.payment.amount);
          }
        }
      });
      
      revenueData.series = revenueByYear;
      bookingData.series = bookingsByYear;
    } else {
      // Default: periode bulanan
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      
      revenueData.categories = months;
      bookingData.categories = months;
      
      // Array untuk menyimpan data per bulan
      const revenueByMonth = Array(months.length).fill(0);
      const bookingsByMonth = Array(months.length).fill(0);
      
      // Mendapatkan seluruh booking dalam rentang waktu 12 bulan terakhir
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      
      const startDate = new Date(currentYear - 1, currentMonth + 1, 1); // 12 bulan yang lalu
      const endDate = new Date(currentYear, currentMonth + 1, 0); // akhir bulan ini
      
      const allBookings = await prisma.booking.findMany({
        where: {
          bookingDate: {
            gte: startDate,
            lte: endDate,
          },
          field: {
            branchId: {
              in: branches.map((b: any) => b.id),
            },
          },
        },
        include: {
          payment: true,
        },
      });
      
      // Mengumpulkan data booking dan pendapatan per bulan
      allBookings.forEach(booking => {
        const bookingMonth = new Date(booking.bookingDate).getMonth();
        
        bookingsByMonth[bookingMonth]++;
        
        if (booking.payment && booking.payment.status === 'paid') {
          revenueByMonth[bookingMonth] += Number(booking.payment.amount);
        }
      });
      
      revenueData.series = revenueByMonth;
      bookingData.series = bookingsByMonth;
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
  const { start, end, interval, pastPeriods } = timeRange;

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
      topCustomers: [],
      bookingData: {
        categories: [],
        series: [],
      },
      incomeData: {
        categories: [],
        series: [],
      },
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

  // Menyiapkan data chart untuk admin cabang
  const generateAdminCabangCharts = async () => {
    // Data untuk chart booking dan pendapatan
    const bookingData = {
      categories: [] as string[],
      series: [] as number[],
    };

    const incomeData = {
      categories: [] as string[],
      series: [] as number[],
    };

    // Berdasarkan interval waktu
    if (interval === 'hour') {
      // Data per jam (untuk periode harian)
      const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      bookingData.categories = hours;
      incomeData.categories = hours;

      // Menginisialisasi array data
      const bookingsByHour = Array(hours.length).fill(0);
      const incomeByHour = Array(hours.length).fill(0);

      // Memproses booking yang ada
      fields.forEach(field => {
        field.Bookings.forEach(booking => {
          // startTime adalah DateTime, bukan string
          const bookingHour = booking.startTime.getHours();
          // Mendapatkan indeks jam yang sesuai
          const hourIndex = Math.floor((bookingHour - 6) / 2); // 6 AM - 8 PM dengan interval 2 jam
          
          if (hourIndex >= 0 && hourIndex < hours.length) {
            bookingsByHour[hourIndex]++;
            
            if (booking.payment && booking.payment.status === 'paid') {
              incomeByHour[hourIndex] += Number(booking.payment.amount);
            }
          }
        });
      });

      bookingData.series = bookingsByHour;
      incomeData.series = incomeByHour;
    } else if (interval === 'year') {
      // Data per tahun
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: pastPeriods }, (_, i) => (currentYear - pastPeriods + i + 1).toString());
      
      bookingData.categories = years;
      incomeData.categories = years;

      // Menginisialisasi array data
      const bookingsByYear = Array(years.length).fill(0);
      const incomeByYear = Array(years.length).fill(0);

      // Mendapatkan semua booking untuk cabang yang dikelola admin
      const allBookings = await prisma.booking.findMany({
        where: {
          fieldId: {
            in: fields.map(f => f.id),
          },
          bookingDate: {
            gte: new Date(parseInt(years[0]), 0, 1), // 1 Jan tahun pertama
            lte: new Date(currentYear, 11, 31), // 31 Des tahun ini
          },
        },
        include: {
          payment: true,
        },
      });

      // Mengumpulkan data booking dan pendapatan per tahun
      allBookings.forEach(booking => {
        const bookingYear = new Date(booking.bookingDate).getFullYear().toString();
        const yearIndex = years.indexOf(bookingYear);
        
        if (yearIndex !== -1) {
          bookingsByYear[yearIndex]++;
          
          if (booking.payment && booking.payment.status === 'paid') {
            incomeByYear[yearIndex] += Number(booking.payment.amount);
          }
        }
      });

      bookingData.series = bookingsByYear;
      incomeData.series = incomeByYear;
    } else {
      // Default: data per bulan
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      
      bookingData.categories = months;
      incomeData.categories = months;

      // Menginisialisasi array data
      const bookingsByMonth = Array(months.length).fill(0);
      const incomeByMonth = Array(months.length).fill(0);

      // Mendapatkan semua booking untuk cabang yang dikelola admin
      const currentYear = new Date().getFullYear();
      const oneYearAgo = new Date(currentYear - 1, new Date().getMonth(), 1);
      
      const allBookings = await prisma.booking.findMany({
        where: {
          fieldId: {
            in: fields.map(f => f.id),
          },
          bookingDate: {
            gte: oneYearAgo,
          },
        },
        include: {
          payment: true,
        },
      });

      // Mengumpulkan data booking dan pendapatan per bulan
      allBookings.forEach(booking => {
        const bookingMonth = new Date(booking.bookingDate).getMonth();
        
        bookingsByMonth[bookingMonth]++;
        
        if (booking.payment && booking.payment.status === 'paid') {
          incomeByMonth[bookingMonth] += Number(booking.payment.amount);
        }
      });

      bookingData.series = bookingsByMonth;
      incomeData.series = incomeByMonth;
    }

    return { bookingData, incomeData };
  };

  const { bookingData, incomeData } = await generateAdminCabangCharts();

  return {
    totalBookings,
    pendingPayments,
    totalIncome: totalIncome.toNumber(),
    availableFields,
    topCustomers: topCustomersWithDetails,
    bookingData,
    incomeData,
  };
};

/**
 * Mendapatkan statistik untuk User biasa
 */
const getUserStats = async (userId: number, timeRange: any): Promise<DashboardStats> => {
  const { interval, pastPeriods } = timeRange;
  
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

  let favoriteField = '-';
  if (favoriteFieldData.length > 0) {
    const field = await prisma.field.findUnique({
      where: {
        id: favoriteFieldData[0].fieldId,
      },
      include: {
        branch: true,
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

  // Mendapatkan booking terbaru
  const recentBookings = await prisma.booking.findMany({
    where: {
      userId,
    },
    orderBy: {
      bookingDate: 'desc',
    },
    take: 5,
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
  const recentBookingsFormatted = recentBookings.map(booking => {
    return {
      id: booking.id.toString(),
      fieldName: booking.field.name,
      branchName: booking.field.branch.name,
      date: booking.bookingDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: `${booking.startTime} - ${booking.endTime}`,
      status: booking.payment?.status?.toLowerCase() || 'pending',
      paymentStatus: booking.payment?.status.toLowerCase() || 'unpaid',
    };
  });
  
  // Menyiapkan data chart untuk aktivitas booking pengguna
  const generateUserActivityChart = async () => {
    // Data untuk grafik aktivitas booking
    const activityData = {
      categories: [] as string[],
      series: [] as number[],
    };
    
    if (interval === 'hour') {
      // Implementasi untuk periode harian (per jam)
      const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      activityData.categories = hours;
      
      // Array untuk menyimpan data per jam
      const activityByHour = Array(hours.length).fill(0);
      
      // Mendapatkan data booking untuk rentang waktu 7 hari terakhir
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const userBookings = await prisma.booking.findMany({
        where: {
          userId,
          bookingDate: {
            gte: sevenDaysAgo,
          },
        },
      });
      
      // Mengumpulkan data booking per jam
      userBookings.forEach(booking => {
        // startTime adalah DateTime, bukan string
        const bookingHour = booking.startTime.getHours();
        // Mendapatkan indeks jam yang sesuai
        const hourIndex = Math.floor((bookingHour - 6) / 2); // 6 AM - 8 PM dengan interval 2 jam
        
        if (hourIndex >= 0 && hourIndex < hours.length) {
          activityByHour[hourIndex]++;
        }
      });
      
      activityData.series = activityByHour;
    } else if (interval === 'year') {
      // Implementasi untuk periode tahunan
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: pastPeriods }, (_, i) => (currentYear - pastPeriods + i + 1).toString());
      
      activityData.categories = years;
      
      // Array untuk menyimpan data per tahun
      const activityByYear = Array(years.length).fill(0);
      
      // Mendapatkan data booking untuk rentang waktu beberapa tahun terakhir
      const userBookings = await prisma.booking.findMany({
        where: {
          userId,
          bookingDate: {
            gte: new Date(parseInt(years[0]), 0, 1), // 1 Jan tahun pertama
          },
        },
      });
      
      // Mengumpulkan data booking per tahun
      userBookings.forEach(booking => {
        const bookingYear = new Date(booking.bookingDate).getFullYear().toString();
        const yearIndex = years.indexOf(bookingYear);
        
        if (yearIndex !== -1) {
          activityByYear[yearIndex]++;
        }
      });
      
      activityData.series = activityByYear;
    } else {
      // Default: periode bulanan
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      
      activityData.categories = months;
      
      // Array untuk menyimpan data per bulan
      const activityByMonth = Array(months.length).fill(0);
      
      // Mendapatkan data booking untuk rentang waktu 12 bulan terakhir
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const userBookings = await prisma.booking.findMany({
        where: {
          userId,
          bookingDate: {
            gte: oneYearAgo,
          },
        },
      });
      
      // Mengumpulkan data booking per bulan
      userBookings.forEach(booking => {
        const bookingMonth = new Date(booking.bookingDate).getMonth();
        activityByMonth[bookingMonth]++;
      });
      
      activityData.series = activityByMonth;
    }
    
    return activityData;
  };
  
  const activityData = await generateUserActivityChart();

  return {
    activeBookings,
    completedBookings,
    favoriteField,
    unreadNotifications,
    recentBookings: recentBookingsFormatted,
    activityData,
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