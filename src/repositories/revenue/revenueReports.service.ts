import prisma from '../../config/services/database';
import { convertBigIntToNumber } from '../../utils/variables/bigInt.utils';
import { DateUtils } from '../../utils/variables/date.utils';
import * as RevenueRepository from './RevenueReports.repositories';
import {
  RevenueData,
  BranchRevenue,
  FieldRevenue,
  TotalStats,
  MonthlyStats,
  CustomerRetention,
  BranchPerformance,
  MonthStats,
} from './revenueReports.interfaces';

export const generateRevenueReport = async (start: Date, end: Date, type: string = 'monthly') => {
  // Get booking data with payments
  const bookingsWithPayments = await RevenueRepository.getBookingsWithPayments(start, end);

  // Process time series data based on requested grouping
  let timeSeriesData: RevenueData[] = [];

  if (type === 'daily') {
    timeSeriesData = processDailyRevenue(bookingsWithPayments);
  } else if (type === 'weekly') {
    timeSeriesData = processWeeklyRevenue(bookingsWithPayments);
  } else {
    // Default: monthly
    timeSeriesData = processMonthlyRevenue(bookingsWithPayments);
  }

  // Get branch and field revenue
  const branchRevenue = processBranchRevenue(bookingsWithPayments);
  const fieldRevenue = processFieldRevenue(bookingsWithPayments);

  // Calculate totals
  const totalRevenue = bookingsWithPayments.reduce(
    (sum, booking) => sum + Number(booking.payment?.amount || 0),
    0,
  );

  const totals: TotalStats = {
    totalRevenue,
    totalBookings: bookingsWithPayments.length,
  };

  return convertBigIntToNumber({
    timeSeriesData,
    branchRevenue,
    fieldRevenue,
    summary: totals,
  });
};

export const generateOccupancyReport = async (start: Date, end: Date, branchId?: number) => {
  // Get field bookings
  const bookings = await RevenueRepository.getBookingsForOccupancy(start, end, branchId);

  // Get all fields
  const allFields = await RevenueRepository.getAllFields(branchId);

  // Calculate field occupancy
  const fieldOccupancy = calculateFieldOccupancy(allFields, bookings, start, end);

  // Get time slot popularity
  const timeSlotPopularity = calculateTimeSlotPopularity(bookings);

  return convertBigIntToNumber({
    fieldOccupancy,
    timeSlotPopularity,
    totalBookings: bookings.length,
  });
};

export const generateBusinessPerformanceReport = async () => {
  // Get bookings from last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const bookings = await RevenueRepository.getBookingsWithDetails(twelveMonthsAgo);

  // Group bookings by month
  const bookingsByMonth = processMonthlyBookingTrends(bookings);

  // Get branch performance
  const branches = await prisma.branch.findMany();
  const branchPerformance = await calculateBranchPerformance(branches, bookings);

  // Calculate customer retention
  const customerRetention = calculateCustomerRetention(bookings);

  // Compare current month with previous month
  const monthComparison = calculateMonthComparison(bookings);

  return convertBigIntToNumber({
    bookingTrends: bookingsByMonth,
    branchPerformance,
    customerRetention,
    monthComparison,
  });
};

export const generateBookingForecast = async () => {
  // Get all bookings with payments
  const bookingsWithPayments = await RevenueRepository.getAllBookingsWithPayments();

  // Group by month
  const historicalData = processMonthlyData(bookingsWithPayments);

  // Calculate growth metrics
  const growthMetrics = calculateGrowthMetrics(historicalData);

  // Generate forecast
  const forecast = generateForecast(historicalData, growthMetrics);

  return convertBigIntToNumber({
    historicalData,
    forecast,
    growthMetrics: {
      avgMonthlyBookingGrowth: growthMetrics.bookingGrowth * 100,
      avgMonthlyRevenueGrowth: growthMetrics.revenueGrowth * 100,
    },
  });
};

// Helper functions
function processDailyRevenue(bookings: any[]): RevenueData[] {
  const dailyData = new Map<string, { revenue: number; bookings: number }>();

  bookings.forEach((booking) => {
    const dateKey = booking.bookingDate.toISOString().split('T')[0];
    const amount = Number(booking.payment?.amount || 0);

    if (dailyData.has(dateKey)) {
      const current = dailyData.get(dateKey)!;
      dailyData.set(dateKey, {
        revenue: current.revenue + amount,
        bookings: current.bookings + 1,
      });
    } else {
      dailyData.set(dateKey, { revenue: amount, bookings: 1 });
    }
  });

  return Array.from(dailyData.entries()).map(([date, data]) => ({
    date,
    revenue: data.revenue,
    bookings: data.bookings,
  }));
}

function processWeeklyRevenue(bookings: any[]): RevenueData[] {
  const weeklyData = new Map<
    string,
    {
      revenue: number;
      bookings: number;
      weekStart: Date;
    }
  >();

  bookings.forEach((booking) => {
    const date = booking.bookingDate;
    const amount = Number(booking.payment?.amount || 0);

    const yearWeek = DateUtils.getYearWeek(date);
    const weekStart = DateUtils.getWeekStart(date);

    if (weeklyData.has(yearWeek)) {
      const current = weeklyData.get(yearWeek)!;
      weeklyData.set(yearWeek, {
        revenue: current.revenue + amount,
        bookings: current.bookings + 1,
        weekStart: current.weekStart,
      });
    } else {
      weeklyData.set(yearWeek, {
        revenue: amount,
        bookings: 1,
        weekStart,
      });
    }
  });

  return Array.from(weeklyData.entries()).map(([weekNumber, data]) => ({
    weekNumber: parseInt(weekNumber.split('-')[1]),
    weekStart: data.weekStart,
    revenue: data.revenue,
    bookings: data.bookings,
  }));
}

function processMonthlyRevenue(bookings: any[]): RevenueData[] {
  const monthlyData = new Map<string, { revenue: number; bookings: number }>();

  bookings.forEach((booking) => {
    const date = booking.bookingDate;
    const amount = Number(booking.payment?.amount || 0);

    const monthKey = DateUtils.formatYearMonth(date);

    if (monthlyData.has(monthKey)) {
      const current = monthlyData.get(monthKey)!;
      monthlyData.set(monthKey, {
        revenue: current.revenue + amount,
        bookings: current.bookings + 1,
      });
    } else {
      monthlyData.set(monthKey, { revenue: amount, bookings: 1 });
    }
  });

  return Array.from(monthlyData.entries()).map(([month, data]) => ({
    month,
    revenue: data.revenue,
    bookings: data.bookings,
  }));
}

function processBranchRevenue(bookings: any[]): BranchRevenue[] {
  const branchRevenueMap = new Map<
    number,
    { branchName: string; revenue: number; bookings: number }
  >();

  bookings.forEach((booking) => {
    if (booking.field?.branch) {
      const { id, name } = booking.field.branch;
      const amount = Number(booking.payment?.amount || 0);

      if (branchRevenueMap.has(id)) {
        const current = branchRevenueMap.get(id)!;
        branchRevenueMap.set(id, {
          branchName: name,
          revenue: current.revenue + amount,
          bookings: current.bookings + 1,
        });
      } else {
        branchRevenueMap.set(id, {
          branchName: name,
          revenue: amount,
          bookings: 1,
        });
      }
    }
  });

  return Array.from(branchRevenueMap.entries())
    .map(([branchId, data]) => ({
      branchId,
      branchName: data.branchName,
      revenue: data.revenue,
      bookings: data.bookings,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function processFieldRevenue(bookings: any[]): FieldRevenue[] {
  const fieldRevenueMap = new Map<
    number,
    {
      fieldName: string;
      branchName: string;
      revenue: number;
      bookings: number;
    }
  >();

  bookings.forEach((booking) => {
    if (booking.field) {
      const { id, name } = booking.field;
      const branchName = booking.field.branch?.name || '';
      const amount = Number(booking.payment?.amount || 0);

      if (fieldRevenueMap.has(id)) {
        const current = fieldRevenueMap.get(id)!;
        fieldRevenueMap.set(id, {
          fieldName: name,
          branchName,
          revenue: current.revenue + amount,
          bookings: current.bookings + 1,
        });
      } else {
        fieldRevenueMap.set(id, {
          fieldName: name,
          branchName,
          revenue: amount,
          bookings: 1,
        });
      }
    }
  });

  return Array.from(fieldRevenueMap.entries())
    .map(([fieldId, data]) => ({
      fieldId,
      fieldName: data.fieldName,
      branchName: data.branchName,
      revenue: data.revenue,
      bookings: data.bookings,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function calculateFieldOccupancy(fields: any[], bookings: any[], start: Date, end: Date) {
  return fields.map((field) => {
    const fieldBookings = bookings.filter((b) => b.fieldId === field.id);

    // Calculate total booked hours
    let totalBookedHours = 0;
    fieldBookings.forEach((booking) => {
      const startTime = new Date(booking.startTime);
      const endTime = new Date(booking.endTime);
      const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      totalBookedHours += hours;
    });

    // Calculate potential available hours (12 hours per day * days in range)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const potentialHours = daysDiff * 12; // Assuming 12 operating hours per day

    // Calculate revenue from payments
    const revenue = fieldBookings.reduce((sum, booking) => {
      if (booking.payment) {
        return sum + Number(booking.payment.amount);
      }
      return sum;
    }, 0);

    return {
      fieldId: field.id,
      fieldName: field.name,
      branchName: field.branch.name,
      totalBookings: fieldBookings.length,
      totalHoursBooked: totalBookedHours,
      occupancyRate: (totalBookedHours / potentialHours) * 100,
      revenue,
    };
  });
}

function calculateTimeSlotPopularity(bookings: any[]) {
  const timeSlotPopularity = [];
  for (let hour = 6; hour < 24; hour++) {
    // Assuming operating hours 6 AM to 11 PM
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

    const bookingsInSlot = bookings.filter((b) => {
      const bookingStartHour = new Date(b.startTime).getHours();
      return bookingStartHour === hour;
    });

    timeSlotPopularity.push({
      timeSlot: `${startTime} - ${endTime}`,
      bookingCount: bookingsInSlot.length,
      popularity: bookings.length > 0 ? (bookingsInSlot.length / bookings.length) * 100 : 0,
    });
  }

  return timeSlotPopularity;
}

function processMonthlyBookingTrends(bookings: any[]): MonthlyStats[] {
  const bookingsByMonthMap = new Map<string, { bookings: number; revenue: number }>();

  bookings.forEach((booking) => {
    const date = booking.bookingDate;
    const monthKey = DateUtils.formatYearMonth(date);
    const amount = booking.payment ? Number(booking.payment.amount) : 0;

    if (bookingsByMonthMap.has(monthKey)) {
      const current = bookingsByMonthMap.get(monthKey)!;
      bookingsByMonthMap.set(monthKey, {
        bookings: current.bookings + 1,
        revenue: current.revenue + amount,
      });
    } else {
      bookingsByMonthMap.set(monthKey, { bookings: 1, revenue: amount });
    }
  });

  return Array.from(bookingsByMonthMap.entries())
    .map(([month, data]) => ({
      month,
      bookings: data.bookings,
      revenue: data.revenue,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function calculateBranchPerformance(
  branches: any[],
  bookings: any[],
): Promise<BranchPerformance[]> {
  return branches
    .map((branch) => {
      const branchBookings = bookings.filter((b) => b.field?.branchId === branch.id);

      // Get unique customers
      const uniqueCustomers = new Set(branchBookings.map((b) => b.userId));

      // Calculate revenue
      const totalRevenue = branchBookings.reduce((sum, booking) => {
        return sum + (booking.payment ? Number(booking.payment.amount) : 0);
      }, 0);

      // Calculate average booking value
      const averageBookingValue =
        branchBookings.length > 0 ? totalRevenue / branchBookings.length : 0;

      return {
        branchName: branch.name,
        branchId: branch.id,
        totalBookings: branchBookings.length,
        uniqueCustomers: uniqueCustomers.size,
        totalRevenue,
        averageBookingValue,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function calculateCustomerRetention(bookings: any[]): CustomerRetention {
  const userBookingsMap = new Map<number, number>();

  bookings.forEach((booking) => {
    if (booking.userId) {
      const count = userBookingsMap.get(booking.userId) || 0;
      userBookingsMap.set(booking.userId, count + 1);
    }
  });

  const totalCustomers = userBookingsMap.size;
  const returningCustomers = Array.from(userBookingsMap.values()).filter(
    (count) => count > 1,
  ).length;
  const totalBookings = Array.from(userBookingsMap.values()).reduce((sum, count) => sum + count, 0);
  const avgBookingsPerCustomer = totalCustomers > 0 ? totalBookings / totalCustomers : 0;

  return {
    totalCustomers,
    returningCustomers,
    avgBookingsPerCustomer,
  };
}

function calculateMonthComparison(bookings: any[]) {
  const currentDate = new Date();
  const firstDayCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const firstDayPreviousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

  // Current month bookings
  const currentMonthBookings = bookings.filter((b) => b.bookingDate >= firstDayCurrentMonth);

  // Previous month bookings
  const previousMonthBookings = bookings.filter(
    (b) => b.bookingDate >= firstDayPreviousMonth && b.bookingDate < firstDayCurrentMonth,
  );

  // Calculate stats
  const currentMonth = calculateMonthStats(currentMonthBookings);
  const previousMonth = calculateMonthStats(previousMonthBookings);

  // Calculate growth rates
  const bookingGrowth =
    previousMonth.bookings > 0
      ? ((currentMonth.bookings - previousMonth.bookings) / previousMonth.bookings) * 100
      : currentMonth.bookings > 0
        ? 100
        : 0;

  const revenueGrowth =
    previousMonth.revenue > 0
      ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100
      : currentMonth.revenue > 0
        ? 100
        : 0;

  return {
    currentMonth,
    previousMonth,
    bookingGrowth,
    revenueGrowth,
  };
}

function calculateMonthStats(bookings: any[]): MonthStats {
  const revenue = bookings.reduce((sum, booking) => {
    return sum + (booking.payment ? Number(booking.payment.amount) : 0);
  }, 0);

  return {
    bookings: bookings.length,
    revenue,
  };
}

function processMonthlyData(bookings: any[]): MonthlyStats[] {
  const monthlyDataMap = new Map<string, { bookings: number; revenue: number }>();

  bookings.forEach((booking) => {
    const date = booking.bookingDate;
    const monthKey = DateUtils.formatYearMonth(date);
    const amount = booking.payment ? Number(booking.payment.amount) : 0;

    if (monthlyDataMap.has(monthKey)) {
      const current = monthlyDataMap.get(monthKey)!;
      monthlyDataMap.set(monthKey, {
        bookings: current.bookings + 1,
        revenue: current.revenue + amount,
      });
    } else {
      monthlyDataMap.set(monthKey, { bookings: 1, revenue: amount });
    }
  });

  return Array.from(monthlyDataMap.entries())
    .map(([month, data]) => ({
      month,
      bookings: data.bookings,
      revenue: data.revenue,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function calculateGrowthMetrics(historicalData: MonthlyStats[]) {
  let totalBookingGrowth = 0;
  let totalRevenueGrowth = 0;
  let monthsWithData = 0;

  for (let i = 1; i < historicalData.length; i++) {
    const prevBookings = historicalData[i - 1].bookings;
    const currBookings = historicalData[i].bookings;
    const prevRevenue = historicalData[i - 1].revenue;
    const currRevenue = historicalData[i].revenue;

    if (prevBookings > 0 && prevRevenue > 0) {
      totalBookingGrowth += (currBookings - prevBookings) / prevBookings;
      totalRevenueGrowth += (currRevenue - prevRevenue) / prevRevenue;
      monthsWithData++;
    }
  }

  return {
    bookingGrowth: monthsWithData > 0 ? totalBookingGrowth / monthsWithData : 0.05,
    revenueGrowth: monthsWithData > 0 ? totalRevenueGrowth / monthsWithData : 0.07,
  };
}

function generateForecast(
  historicalData: MonthlyStats[],
  growthMetrics: { bookingGrowth: number; revenueGrowth: number },
): MonthlyStats[] {
  const forecast: MonthlyStats[] = [];
  const lastMonth =
    historicalData.length > 0
      ? historicalData[historicalData.length - 1]
      : {
          month: DateUtils.getCurrentYearMonth(),
          bookings: 100,
          revenue: 5000,
        };

  let forecastBookings = lastMonth.bookings;
  let forecastRevenue = lastMonth.revenue;

  for (let i = 1; i <= 6; i++) {
    const forecastMonth = DateUtils.getNextMonth(lastMonth.month, i);

    forecastBookings = Math.round(forecastBookings * (1 + growthMetrics.bookingGrowth));
    forecastRevenue = Math.round(forecastRevenue * (1 + growthMetrics.revenueGrowth));

    forecast.push({
      month: forecastMonth,
      bookings: forecastBookings,
      revenue: forecastRevenue,
      isProjection: true,
    });
  }

  return forecast;
}
