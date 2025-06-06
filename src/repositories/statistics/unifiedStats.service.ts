import prisma from '../../config/services/database';
import { Decimal } from '@prisma/client/runtime/library';
import { 
  startOfMonth, endOfMonth, startOfDay, endOfDay, 
  startOfYear, endOfYear, subMonths, subYears
} from 'date-fns';
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
 * Menambahkan grafik data untuk Super Admin
 */
export const getSuperAdminStatsWithCharts = async (timeRange: any): Promise<DashboardStats> => {
  // Dapatkan stats dasar
  const basicStats = await getSuperAdminStats(timeRange);
  const { start, end, interval } = timeRange;
  
  // Dapatkan seluruh data booking untuk pembuatan grafik
  const bookings = await prisma.booking.findMany({
    include: {
      payment: true,
    }
  });
  
  // Mengelompokkan data booking dan pendapatan
  const bookingsByDate: Record<string, number> = {};
  const incomeByDate: Record<string, number> = {};
  
  // Menghitung total booking dan pendapatan untuk periode ini
  let totalBookings = 0;
  let totalIncome = 0;
  
  // Proses semua booking untuk statistik
  bookings.forEach((booking) => {
    const bookingDate = new Date(booking.bookingDate);
    
    // Menghitung total untuk periode yang dipilih
    if (bookingDate >= start && bookingDate <= end) {
      totalBookings++;
      
      if (booking.payment && booking.payment.status === 'paid') {
        totalIncome += Number(booking.payment.amount);
      }
    }
    
    // Mendapatkan tanggal booking untuk grafik
    let dateKey;
    
    if (interval === 'hour') {
      // Filter untuk hanya menampilkan data hari ini pada chart hourly
      const today = new Date().setHours(0, 0, 0, 0);
      const bookingDay = new Date(bookingDate).setHours(0, 0, 0, 0);
      if (bookingDay === today) {
        // Format jam: "HH:00"
        dateKey = `${bookingDate.getHours().toString().padStart(2, '0')}:00`;
        // Hitung booking per periode untuk grafik
        bookingsByDate[dateKey] = (bookingsByDate[dateKey] || 0) + 1;

        // Hitung pendapatan jika booking sudah dibayar
        if (booking.payment && booking.payment.status === 'paid') {
          const amount = Number(booking.payment.amount);
          incomeByDate[dateKey] = (incomeByDate[dateKey] || 0) + amount;
        }
      }
    } else if (interval === 'year') {
      // Format tahun: "YYYY"
      dateKey = bookingDate.getFullYear().toString();
      // Hitung booking per periode untuk grafik
      bookingsByDate[dateKey] = (bookingsByDate[dateKey] || 0) + 1;

      // Hitung pendapatan jika booking sudah dibayar
      if (booking.payment && booking.payment.status === 'paid') {
        const amount = Number(booking.payment.amount);
        incomeByDate[dateKey] = (incomeByDate[dateKey] || 0) + amount;
      }
    } else {
      // Format bulan: indeks 0-11
      // Filter untuk hanya menampilkan data di tahun ini pada chart monthly
      const currentYear = new Date().getFullYear();
      if (bookingDate.getFullYear() === currentYear) {
        dateKey = bookingDate.getMonth().toString();
        // Hitung booking per periode untuk grafik (untuk bulan di tahun ini saja)
        bookingsByDate[dateKey] = (bookingsByDate[dateKey] || 0) + 1;

        // Hitung pendapatan jika booking sudah dibayar
        if (booking.payment && booking.payment.status === 'paid') {
          const amount = Number(booking.payment.amount);
          incomeByDate[dateKey] = (incomeByDate[dateKey] || 0) + amount;
        }
      }
    }
  });

  // Generate data untuk grafik
  const revenueData = {
    categories: [] as string[],
    series: [] as number[],
  };

  const bookingData = {
    categories: [] as string[],
    series: [] as number[],
  };
  
  // Kategori grafik berdasarkan interval
  if (interval === 'hour') {
    // Kategori per jam (06:00 - 23:00)
    const hours = Array.from({ length: 18 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);
    bookingData.categories = hours;
    revenueData.categories = hours;
    
    // Mengisi data berdasarkan data real
    bookingData.series = hours.map(hour => bookingsByDate[hour] || 0);
    revenueData.series = hours.map(hour => incomeByDate[hour] || 0);
  } else if (interval === 'year') {
    // Kategori per tahun
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => (currentYear - 5 + i).toString());
    
    // Tambahkan tahun dari data booking yang ada
    const allYears = new Set<string>(years);
    for (const dateKey in bookingsByDate) {
      allYears.add(dateKey);
    }
    
    // Konversi ke array dan urutkan
    const sortedYears = Array.from(allYears).sort();
    bookingData.categories = sortedYears;
    revenueData.categories = sortedYears;
    
    // Mengisi data berdasarkan data real
    bookingData.series = sortedYears.map(year => bookingsByDate[year] || 0);
    revenueData.series = sortedYears.map(year => incomeByDate[year] || 0);
  } else {
    // Default: periode bulanan (berdasarkan bulan 0-11)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    bookingData.categories = months;
    revenueData.categories = months;
    
    // Array untuk menyimpan data per bulan pada tahun ini
    const bookingsByMonth: number[] = Array(12).fill(0);
    const incomeByMonth: number[] = Array(12).fill(0);
    
    // Mengelompokkan data berdasarkan bulan (hanya untuk tahun ini)
    for (const monthKey in bookingsByDate) {
      const monthIndex = parseInt(monthKey);
      if (monthIndex >= 0 && monthIndex < 12) {
        bookingsByMonth[monthIndex] += bookingsByDate[monthKey];
      }
    }
    
    for (const monthKey in incomeByDate) {
      const monthIndex = parseInt(monthKey);
      if (monthIndex >= 0 && monthIndex < 12) {
        incomeByMonth[monthIndex] += incomeByDate[monthKey];
      }
    }
    
    bookingData.series = bookingsByMonth;
    revenueData.series = incomeByMonth;
  }
  
  // Gabungkan stats dasar dengan data grafik
  return {
    ...basicStats,
    totalBookings,
    totalIncome,
    revenueData,
    bookingData,
  };
};

/**
 * Mendapatkan statistik untuk Owner Cabang
 */
export const getOwnerCabangStats = async (userId: number, timeRange: any): Promise<DashboardStats> => {
  // Hanya menggunakan variabel yang benar-benar digunakan
  const { start, end, interval, pastPeriods } = timeRange;

  // Mendapatkan semua cabang yang dimiliki oleh owner
  const branches = await prisma.branch.findMany({
    where: {
      ownerId: userId,
    },
    include: {
      Fields: {
        include: {
          Bookings: {
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

  // Menghitung pendapatan dan booking berdasarkan periode
  let periodStart = start;
  let periodEnd = end;
  
  // Proses semua booking untuk mendapatkan statistik real
  branches.forEach((branch) => {
    branch.Fields.forEach((field) => {
      field.Bookings.forEach((booking) => {
        const bookingDate = new Date(booking.bookingDate);
        
        // Hanya count booking dan pendapatan dalam periode yang dipilih untuk totalIncome dan totalBookings
        if (bookingDate >= periodStart && bookingDate <= periodEnd) {
          totalBookings++;
          
          // Hitung pendapatan jika booking sudah dibayar
          if (booking.payment && booking.payment.status === 'paid') {
            const amount = Number(booking.payment.amount);
            totalIncome = totalIncome.plus(amount);
          }
        }
        
        // Mendapatkan tanggal booking untuk grafik
        let dateKey;
        
        if (interval === 'hour') {
          // Filter untuk hanya menampilkan data hari ini pada chart hourly
          const today = new Date().setHours(0, 0, 0, 0);
          const bookingDay = new Date(bookingDate).setHours(0, 0, 0, 0);
          if (bookingDay === today) {
            // Format jam: "HH:00"
            dateKey = `${bookingDate.getHours().toString().padStart(2, '0')}:00`;
            // Hitung booking per periode untuk grafik
            bookingsByDate[dateKey] = (bookingsByDate[dateKey] || 0) + 1;

            // Hitung pendapatan jika booking sudah dibayar
            if (booking.payment && booking.payment.status === 'paid') {
              const amount = Number(booking.payment.amount);
              incomeByDate[dateKey] = (incomeByDate[dateKey] || 0) + amount;
            }
          }
        } else if (interval === 'year') {
          // Format tahun: "YYYY"
          dateKey = bookingDate.getFullYear().toString();
          // Hitung booking per periode untuk grafik
          bookingsByDate[dateKey] = (bookingsByDate[dateKey] || 0) + 1;

          // Hitung pendapatan jika booking sudah dibayar
          if (booking.payment && booking.payment.status === 'paid') {
            const amount = Number(booking.payment.amount);
            incomeByDate[dateKey] = (incomeByDate[dateKey] || 0) + amount;
          }
        } else {
          // Format bulan: indeks 0-11
          // Filter untuk hanya menampilkan data di tahun ini pada chart monthly
          const currentYear = new Date().getFullYear();
          if (bookingDate.getFullYear() === currentYear) {
            dateKey = bookingDate.getMonth().toString();
            // Hitung booking per periode untuk grafik (untuk bulan di tahun ini saja)
            bookingsByDate[dateKey] = (bookingsByDate[dateKey] || 0) + 1;

            // Hitung pendapatan jika booking sudah dibayar
            if (booking.payment && booking.payment.status === 'paid') {
              const amount = Number(booking.payment.amount);
              incomeByDate[dateKey] = (incomeByDate[dateKey] || 0) + amount;
            }
          }
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

  // Kategori grafik berdasarkan interval
  if (interval === 'hour') {
    // Kategori per jam (06:00 - 23:00)
    const hours = Array.from({ length: 18 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);
    bookingData.categories = hours;
    revenueData.categories = hours;
    
    // Mengisi data berdasarkan data real
    bookingData.series = hours.map(hour => bookingsByDate[hour] || 0);
    revenueData.series = hours.map(hour => incomeByDate[hour] || 0);
  } else if (interval === 'year') {
    // Kategori per tahun
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: pastPeriods }, (_, i) => (currentYear - pastPeriods + i + 1).toString());
    
    // Tambahkan tahun dari data booking yang ada
    const allYears = new Set<string>(years);
    for (const dateKey in bookingsByDate) {
      allYears.add(dateKey);
    }
    
    // Konversi ke array dan urutkan
    const sortedYears = Array.from(allYears).sort();
    bookingData.categories = sortedYears;
    revenueData.categories = sortedYears;
    
    // Mengisi data berdasarkan data real
    bookingData.series = sortedYears.map(year => bookingsByDate[year] || 0);
    revenueData.series = sortedYears.map(year => incomeByDate[year] || 0);
  } else {
    // Default: periode bulanan (berdasarkan bulan 0-11)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    bookingData.categories = months;
    revenueData.categories = months;
    
    // Array untuk menyimpan data per bulan pada tahun ini
    const bookingsByMonth: number[] = Array(12).fill(0);
    const incomeByMonth: number[] = Array(12).fill(0);
    
    // Mengelompokkan data berdasarkan bulan (hanya untuk tahun ini)
    for (const monthKey in bookingsByDate) {
      const monthIndex = parseInt(monthKey);
      if (monthIndex >= 0 && monthIndex < 12) {
        bookingsByMonth[monthIndex] += bookingsByDate[monthKey];
      }
    }
    
    for (const monthKey in incomeByDate) {
      const monthIndex = parseInt(monthKey);
      if (monthIndex >= 0 && monthIndex < 12) {
        incomeByMonth[monthIndex] += incomeByDate[monthKey];
      }
    }
    
    bookingData.series = bookingsByMonth;
    revenueData.series = incomeByMonth;
  }
  
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
      status: admin.branch.status && typeof admin.branch.status === 'string' 
        ? admin.branch.status.toLowerCase() === 'active' ? 'active' : 'inactive'
        : 'inactive',
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
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'branch_owner':
      return 'Pemilik Cabang';
    case 'branch_admin':
      return 'Admin Cabang';
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
  const today = new Date();
  const availableFields = branch.Fields.filter((field) => {
    const fieldBookingsToday = field.Bookings.filter(
      (booking) => new Date(booking.bookingDate).toDateString() === today.toDateString()
    );
    return fieldBookingsToday.length === 0;
  }).length;

  branch.Fields.forEach((field) => {
    field.Bookings.forEach((booking) => {
      const bookingDate = new Date(booking.bookingDate);
      
      // Hanya count booking dan pendapatan dalam periode yang dipilih
      if (bookingDate >= start && bookingDate <= end) {
        totalBookings++;

        // Menghitung pembayaran pending
        if (booking.payment && booking.payment.status === PaymentStatus.PENDING) {
          pendingPayments++;
        }

        // Menghitung total pendapatan dari booking yang sudah dibayar
        if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
          totalIncome = totalIncome.plus(booking.payment.amount);
        }
      }

      // Mengelompokkan booking berdasarkan tanggal untuk grafik
      let dateKey;
      
      if (interval === 'hour') {
        // Filter untuk hanya menampilkan data hari ini pada chart hourly
        const todayDate = new Date().setHours(0, 0, 0, 0);
        const bookingDay = new Date(bookingDate).setHours(0, 0, 0, 0);
        if (bookingDay === todayDate) {
          // Format jam: "HH:00"
          dateKey = `${bookingDate.getHours().toString().padStart(2, '0')}:00`;
          // Mengelompokkan booking berdasarkan jam
          bookingsPerDay[dateKey] = (bookingsPerDay[dateKey] || 0) + 1;

          // Mengelompokkan pendapatan berdasarkan jam
          if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
            incomePerDay[dateKey] = (incomePerDay[dateKey] || 0) + Number(booking.payment.amount);
          }
        }
      } else if (interval === 'year') {
        // Format tahun: "YYYY"
        dateKey = bookingDate.getFullYear().toString();
        // Mengelompokkan booking berdasarkan tahun
        bookingsPerDay[dateKey] = (bookingsPerDay[dateKey] || 0) + 1;

        // Mengelompokkan pendapatan berdasarkan tahun
        if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
          incomePerDay[dateKey] = (incomePerDay[dateKey] || 0) + Number(booking.payment.amount);
        }
      } else {
        // Format bulan: bulan 0-11 dari tahun ini
        const currentYear = new Date().getFullYear();
        if (bookingDate.getFullYear() === currentYear) {
          dateKey = bookingDate.getMonth().toString();
          // Mengelompokkan booking berdasarkan bulan di tahun ini
          bookingsPerDay[dateKey] = (bookingsPerDay[dateKey] || 0) + 1;

          // Mengelompokkan pendapatan berdasarkan bulan di tahun ini
          if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
            incomePerDay[dateKey] = (incomePerDay[dateKey] || 0) + Number(booking.payment.amount);
          }
        }
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

  const revenueData = {
    categories: [] as string[],
    series: [] as number[],
  };

  // Kategori grafik berdasarkan interval
  if (interval === 'hour') {
    // Kategori per jam (06:00 - 23:00)
    const hours = Array.from({ length: 18 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);
    bookingData.categories = hours;
    revenueData.categories = hours;
    
    // Mengisi data berdasarkan data real
    bookingData.series = hours.map(hour => bookingsPerDay[hour] || 0);
    revenueData.series = hours.map(hour => incomePerDay[hour] || 0);
  } else if (interval === 'year') {
    // Kategori per tahun
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: pastPeriods }, (_, i) => (currentYear - pastPeriods + i + 1).toString());
    
    // Tambahkan tahun dari data booking yang ada
    const allYears = new Set<string>(years);
    for (const dateKey in bookingsPerDay) {
      allYears.add(dateKey);
    }
    
    // Konversi ke array dan urutkan
    const sortedYears = Array.from(allYears).sort();
    bookingData.categories = sortedYears;
    revenueData.categories = sortedYears;
    
    // Mengisi data berdasarkan data real
    bookingData.series = sortedYears.map(year => bookingsPerDay[year] || 0);
    revenueData.series = sortedYears.map(year => incomePerDay[year] || 0);
  } else {
    // Default: periode bulanan (berdasarkan bulan 0-11)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    bookingData.categories = months;
    revenueData.categories = months;
    
    // Array untuk menyimpan data per bulan pada tahun ini
    const bookingsByMonth: number[] = Array(12).fill(0);
    const incomeByMonth: number[] = Array(12).fill(0);
    
    // Mengelompokkan data berdasarkan bulan (hanya untuk tahun ini)
    for (const monthKey in bookingsPerDay) {
      const monthIndex = parseInt(monthKey);
      if (monthIndex >= 0 && monthIndex < 12) {
        bookingsByMonth[monthIndex] += bookingsPerDay[monthKey];
      }
    }
    
    for (const monthKey in incomePerDay) {
      const monthIndex = parseInt(monthKey);
      if (monthIndex >= 0 && monthIndex < 12) {
        incomeByMonth[monthIndex] += incomePerDay[monthKey];
      }
    }
    
    bookingData.series = bookingsByMonth;
    revenueData.series = incomeByMonth;
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
    revenueData,
    topCustomers,
  };
};

/**
 * Mendapatkan statistik untuk User
 */
export const getUserStats = async (userId: number, timeRange: any): Promise<DashboardStats> => {
  const { start: _start, end: _end } = timeRange;

  // Mendapatkan data user, booking dan notifikasi
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      Bookings: {
        where: {
          // Hapus filter waktu untuk mendapatkan semua booking
          // bookingDate: {
          //   gte: start,
          //   lte: end,
          // },
        },
        include: {
          field: {
            include: {
              branch: true,
            },
          },
          payment: true,
        },
        orderBy: {
          bookingDate: 'desc',
        },
      },
      notifications: {
        where: {
          isRead: false,
        },
      },
    },
  });

  // Menghitung jumlah booking aktif (yang belum lewat tanggalnya)
  const today = new Date();
  const activeBookings = user?.Bookings.filter(
    (booking) => new Date(booking.bookingDate) >= today
  ).length || 0;

  // Menghitung jumlah booking selesai
  const completedBookings = user?.Bookings.filter(
    (booking) => new Date(booking.bookingDate) < today
  ).length || 0;

  // Mendapatkan lapangan favorit
  const fieldCounts: Record<string, { count: number; name: string }> = {};
  user?.Bookings.forEach((booking) => {
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
  const unreadNotifications = user?.notifications.length || 0;

  // Data untuk grafik aktivitas berdasarkan booking per bulan
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  
  // Array untuk menyimpan jumlah aktivitas booking per bulan
  const activityByMonth: number[] = Array(12).fill(0);
  
  // Mengelompokkan booking berdasarkan bulan
  user?.Bookings.forEach((booking) => {
    const bookingMonth = new Date(booking.bookingDate).getMonth();
    activityByMonth[bookingMonth]++;
  });
  
  const activityData = {
    categories: monthNames,
    series: activityByMonth,
  };

  // Mendapatkan booking terbaru untuk ditampilkan
  const recentBookings = user?.Bookings.slice(0, 5).map((booking) => ({
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