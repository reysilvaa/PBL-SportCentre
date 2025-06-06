import { prisma } from '../../config';
import { Decimal } from '@prisma/client/runtime/library';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

/**
 * Menghasilkan laporan pendapatan berdasarkan periode waktu
 */
export const generateRevenueReport = async (
  start: Date,
  end: Date,
  type: string = 'daily',
  branchId?: number
): Promise<any> => {
  try {
    // Query semua pembayaran yang sudah dibayar dalam periode
    const payments = await prisma.payment.findMany({
      where: {
        status: 'paid',
        booking: {
          bookingDate: {
            gte: start,
            lte: end,
          },
          field: branchId ? { branchId } : undefined,
        },
      },
      include: {
        booking: {
          include: {
            field: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Format data untuk laporan
    const formatReportData = (data: any[]) => {
      // Kelompokkan data berdasarkan periode waktu
      const groupedData: Record<string, { total: Decimal; count: number }> = {};

      data.forEach((payment) => {
        const date = new Date(payment.booking.bookingDate);
        const periodKey = date.toISOString().split('T')[0]; // Format YYYY-MM-DD

        if (!groupedData[periodKey]) {
          groupedData[periodKey] = { total: new Decimal(0), count: 0 };
        }

        groupedData[periodKey].total = groupedData[periodKey].total.plus(payment.amount);
        groupedData[periodKey].count += 1;
      });

      // Konversi ke array untuk chart
      return Object.entries(groupedData).map(([period, data]) => ({
        period,
        total: data.total.toNumber(),
        count: data.count,
      }));
    };

    // Format berdasarkan tipe laporan
    let reportData;

    switch (type) {
      case 'daily':
        reportData = formatReportData(payments);
        break;
      case 'monthly':
        reportData = formatReportData(payments);
        break;
      case 'yearly':
        reportData = formatReportData(payments);
        break;
      default:
        reportData = formatReportData(payments);
    }

    // Hitung total pendapatan
    const totalRevenue = payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0)).toNumber();
    const totalBookings = payments.length;

    return {
      reportType: type,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalRevenue,
      totalBookings,
      data: reportData,
    };
  } catch (error) {
    console.error('Error generating revenue report:', error);
    throw error;
  }
};

/**
 * Menghasilkan laporan okupansi lapangan berdasarkan periode waktu
 */
export const generateOccupancyReport = async (start: Date, end: Date, branchId?: number): Promise<any> => {
  try {
    // Query semua booking dalam periode
    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: start,
          lte: end,
        },
        field: branchId ? { branchId } : undefined,
      },
      include: {
        field: {
          include: {
            branch: true,
          },
        },
      },
      orderBy: {
        bookingDate: 'asc',
      },
    });

    // Group by field
    const fieldOccupancy: Record<string, { bookings: number; hours: number; field: any }> = {};

    bookings.forEach((booking) => {
      const fieldId = booking.fieldId.toString();
      const startTime = new Date(booking.startTime);
      const endTime = new Date(booking.endTime);
      const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      if (!fieldOccupancy[fieldId]) {
        fieldOccupancy[fieldId] = {
          bookings: 0,
          hours: 0,
          field: booking.field,
        };
      }

      fieldOccupancy[fieldId].bookings += 1;
      fieldOccupancy[fieldId].hours += hours;
    });

    // Format data untuk laporan
    const occupancyData = Object.entries(fieldOccupancy).map(([fieldId, data]) => ({
      fieldId,
      fieldName: data.field.name,
      branchName: data.field.branch.name,
      totalBookings: data.bookings,
      totalHours: Math.round(data.hours * 10) / 10, // Round to 1 decimal place
      averageHoursPerBooking: data.bookings > 0 ? Math.round((data.hours / data.bookings) * 10) / 10 : 0,
    }));

    // Menghitung statistik umum
    const totalBookings = bookings.length;
    const totalHours = occupancyData.reduce((sum, item) => sum + item.totalHours, 0);
    const averageHoursPerBooking = totalBookings > 0 ? totalHours / totalBookings : 0;

    return {
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalBookings,
      totalHours,
      averageHoursPerBooking: Math.round(averageHoursPerBooking * 10) / 10,
      data: occupancyData,
    };
  } catch (error) {
    console.error('Error generating occupancy report:', error);
    throw error;
  }
};

/**
 * Menghasilkan laporan performa bisnis
 */
export const generateBusinessPerformanceReport = async (branchId?: number): Promise<any> => {
  try {
    // Mendapatkan data 6 bulan terakhir
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 6);

    // Dapatkan data booking dan pendapatan per bulan
    const monthlyRevenueData = [];
    const monthlyBookingData = [];

    for (let i = 0; i < 6; i++) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const monthLabel = monthStart.toISOString().split('T')[0].substring(0, 7); // Ambil YYYY-MM saja

      // Query pendapatan bulan ini
      const payments = await prisma.payment.findMany({
        where: {
          status: 'paid',
          booking: {
            bookingDate: {
              gte: monthStart,
              lte: monthEnd,
            },
            field: branchId ? { branchId } : undefined,
          },
        },
        include: {
          booking: true,
        },
      });

      // Hitung total pendapatan bulan ini
      const totalRevenue = payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0)).toNumber();
      
      // Masukkan ke array data
      monthlyRevenueData.unshift({
        month: monthLabel,
        revenue: totalRevenue,
      });
      
      monthlyBookingData.unshift({
        month: monthLabel,
        bookings: payments.length,
      });
    }

    // Mendapatkan lapangan terpopuler (most booked)
    const popularFields = await prisma.booking.groupBy({
      by: ['fieldId'],
      where: {
        bookingDate: {
          gte: sixMonthsAgo,
          lte: now,
        },
        field: branchId ? { branchId } : undefined,
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

    // Dapatkan detail dari field populer
    const fieldIds = popularFields.map(item => item.fieldId);
    const fields = await prisma.field.findMany({
      where: {
        id: {
          in: fieldIds,
        },
      },
      include: {
        branch: true,
      },
    });

    // Gabungkan data field dengan jumlah booking
    const topFields = popularFields.map(item => {
      const field = fields.find(f => f.id === item.fieldId);
      return {
        fieldId: item.fieldId.toString(),
        fieldName: field?.name || 'Unknown',
        branchName: field?.branch.name || 'Unknown',
        bookingCount: item._count.id,
      };
    });

    return {
      revenueData: monthlyRevenueData,
      bookingData: monthlyBookingData,
      topFields,
    };
  } catch (error) {
    console.error('Error generating business performance report:', error);
    throw error;
  }
};

/**
 * Menghasilkan prediksi booking (contoh sederhana)
 */
export const generateBookingForecast = async (branchId?: number): Promise<any> => {
  try {
    // Mendapatkan data 3 bulan terakhir
    const now = new Date();
    const threeMonthsAgo = subMonths(now, 3);

    // Query jumlah booking per bulan
    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: {
          gte: threeMonthsAgo,
          lte: now,
        },
        field: branchId ? { branchId } : undefined,
      },
      include: {
        field: true,
      },
      orderBy: {
        bookingDate: 'asc',
      },
    });

    // Group by month
    const bookingsByMonth: Record<string, number> = {};
    
    bookings.forEach(booking => {
      const monthKey = new Date(booking.bookingDate).toISOString().split('T')[0].substring(0, 7); // Ambil YYYY-MM saja
      bookingsByMonth[monthKey] = (bookingsByMonth[monthKey] || 0) + 1;
    });

    // Contoh data historis
    const historicalData = Object.entries(bookingsByMonth).map(([month, count]) => ({
      month,
      bookings: count,
      type: 'historical',
    }));

    // Contoh prediksi sederhana (rata-rata * 1.1 untuk 3 bulan ke depan)
    const avgBookings = historicalData.reduce((sum, item) => sum + item.bookings, 0) / historicalData.length;
    const currentMonthIndex = now.getMonth();
    
    const forecastData = [];
    for (let i = 1; i <= 3; i++) {
      const futureMonth = new Date(now.getFullYear(), currentMonthIndex + i, 1);
      forecastData.push({
        month: futureMonth.toISOString().split('T')[0].substring(0, 7), // Ambil YYYY-MM saja
        bookings: Math.round(avgBookings * (1 + 0.05 * i)),
        type: 'forecast',
      });
    }

    // Lapangan dengan peningkatan booking terbesar
    const trendingFields = await prisma.booking.groupBy({
      by: ['fieldId'],
      where: {
        bookingDate: {
          gte: threeMonthsAgo,
        },
        field: branchId ? { branchId } : undefined,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 3,
    });

    // Mendapatkan detail field dan branch
    const fieldIds = trendingFields.map(item => item.fieldId);
    const fieldsWithBranch = await prisma.field.findMany({
      where: {
        id: { in: fieldIds },
      },
      include: {
        branch: true,
      },
    });

    // Format hasil untuk response
    const formattedTrendingFields = trendingFields.map(item => {
      const fieldData = fieldsWithBranch.find(f => f.id === item.fieldId);
      return {
        id: item.fieldId.toString(),
        name: fieldData?.name || 'Unknown',
        branch_name: fieldData?.branch.name || 'Unknown',
        total_bookings: item._count.id,
      };
    });

    return {
      bookingTrend: [...historicalData, ...forecastData],
      trendingFields: formattedTrendingFields,
    };
  } catch (error) {
    console.error('Error generating booking forecast:', error);
    throw error;
  }
}; 