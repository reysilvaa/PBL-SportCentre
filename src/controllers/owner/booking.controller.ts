import { Request, Response } from 'express';
import prisma from '../../config/database';
import {convertBigIntToNumber} from '../../utils/bigInt.utils'

// Define interface for Request with user
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

// Define types for raw query results
interface RevenueData {
  date?: string;
  weekNumber?: number;
  weekStart?: Date;
  month?: string;
  revenue: number;
  bookings: number;
}

interface BranchRevenue {
  branchName: string;
  branchId: number;
  revenue: number;
  bookings: number;
}

interface FieldRevenue {
  fieldName: string;
  fieldId: number;
  branchName: string;
  revenue: number;
  bookings: number;
}

interface TotalStats {
  totalRevenue: number;
  totalBookings: number;
}

interface MonthlyStats {
  month: string;
  bookings: number;
  revenue: number;
  isProjection?: boolean;
}

interface CustomerRetention {
  totalCustomers: number;
  returningCustomers: number;
  avgBookingsPerCustomer: number;
}

interface BranchPerformance {
  branchName: string;
  branchId: number;
  totalBookings: number;
  uniqueCustomers: number;
  totalRevenue: number;
  averageBookingValue: number;
}

interface MonthStats {
  bookings: number;
  revenue: number;
}

/**
 * Owner Booking Controller
 * Handles operations that venue owners can perform
 */

export const getRevenueReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, type } = req.query;
    
    // Validate date range
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Start date and end date are required' });
      return;
    }
    
    // Parse date range
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    let revenueData: RevenueData[];
    
    // Group revenue by different time periods
    switch (type) {
      case 'daily':
        revenueData = await prisma.$queryRaw<RevenueData[]>`
          SELECT 
            DATE(b.bookingDate) as date,
            SUM(p.amount) as revenue,
            COUNT(*) as bookings
          FROM Payment p
          JOIN Booking b ON p.bookingId = b.id
          WHERE 
            p.status = 'paid' AND
            b.bookingDate BETWEEN ${start} AND ${end}
          GROUP BY DATE(b.bookingDate)
          ORDER BY date
        `;
        break;
      
      case 'weekly':
        revenueData = await prisma.$queryRaw<RevenueData[]>`
          SELECT 
            YEARWEEK(b.bookingDate, 1) as weekNumber,
            MIN(DATE(b.bookingDate)) as weekStart,
            SUM(p.amount) as revenue,
            COUNT(*) as bookings
          FROM Payment p
          JOIN Booking b ON p.bookingId = b.id
          WHERE 
            p.status = 'paid' AND
            b.bookingDate BETWEEN ${start} AND ${end}
          GROUP BY YEARWEEK(b.bookingDate, 1)
          ORDER BY weekNumber
        `;
        break;
        
      case 'monthly':
      default:
        revenueData = await prisma.$queryRaw<RevenueData[]>`
          SELECT 
            DATE_FORMAT(b.bookingDate, '%Y-%m') as month,
            SUM(p.amount) as revenue,
            COUNT(*) as bookings
          FROM Payment p
          JOIN Booking b ON p.bookingId = b.id
          WHERE 
            p.status = 'paid' AND
            b.bookingDate BETWEEN ${start} AND ${end}
          GROUP BY DATE_FORMAT(b.bookingDate, '%Y-%m')
          ORDER BY month
        `;
        break;
    }
    
    // Get branch-wise revenue
    const branchRevenue = await prisma.$queryRaw<BranchRevenue[]>`
      SELECT 
        br.name as branchName,
        br.id as branchId,
        SUM(p.amount) as revenue,
        COUNT(*) as bookings
      FROM Payment p
      JOIN Booking b ON p.bookingId = b.id
      JOIN Field f ON b.fieldId = f.id
      JOIN Branch br ON f.branchId = br.id
      WHERE 
        p.status = 'paid' AND
        b.bookingDate BETWEEN ${start} AND ${end}
      GROUP BY br.id, br.name
      ORDER BY revenue DESC
    `;
    
    // Get field-wise revenue
    const fieldRevenue = await prisma.$queryRaw<FieldRevenue[]>`
      SELECT 
        f.name as fieldName,
        f.id as fieldId,
        br.name as branchName,
        SUM(p.amount) as revenue,
        COUNT(*) as bookings
      FROM Payment p
      JOIN Booking b ON p.bookingId = b.id
      JOIN Field f ON b.fieldId = f.id
      JOIN Branch br ON f.branchId = br.id
      WHERE 
        p.status = 'paid' AND
        b.bookingDate BETWEEN ${start} AND ${end}
      GROUP BY f.id, f.name, br.name
      ORDER BY revenue DESC
    `;
    
    // Calculate totals
    const totals = await prisma.$queryRaw<TotalStats[]>`
      SELECT 
        SUM(p.amount) as totalRevenue,
        COUNT(*) as totalBookings
      FROM Payment p
      JOIN Booking b ON p.bookingId = b.id
      WHERE 
        p.status = 'paid' AND
        b.bookingDate BETWEEN ${start} AND ${end}
    `;
    
    res.json(convertBigIntToNumber({
      timeSeriesData: revenueData,
      branchRevenue,
      fieldRevenue,
      summary: totals[0]
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getOccupancyReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, branchId } = req.query;
    
    // Validate date range
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Start date and end date are required' });
      return;
    }
    
    // Parse date range
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    // Build filter conditions
    const where: {
      bookingDate: {
        gte: Date;
        lte: Date;
      };
      field?: {
        branchId: number;
      };
    } = {
      bookingDate: {
        gte: start,
        lte: end
      }
    };
    
    if (branchId) {
      where.field = {
        branchId: parseInt(branchId as string)
      };
    }
    
    // Get field occupancy rates
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        field: {
          include: {
            branch: true
          }
        },
        payment: true
      },
      orderBy: {
        bookingDate: 'asc'
      }
    });
    
    // Get all fields (to calculate occupancy even for fields with no bookings)
    const allFields = await prisma.field.findMany({
      where: branchId ? { branchId: parseInt(branchId as string) } : {},
      include: {
        branch: true
      }
    });
    
    // Calculate hours booked per field
    const fieldOccupancy = allFields.map(field => {
      const fieldBookings = bookings.filter(b => b.fieldId === field.id);
      
      // Calculate total booked hours
      let totalBookedHours = 0;
      fieldBookings.forEach(booking => {
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
        revenue
      };
    });
    
    // Get time slot popularity (for all fields)
    const timeSlotPopularity = [];
    for (let hour = 6; hour < 24; hour++) { // Assuming operating hours 6 AM to 11 PM
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      const bookingsInSlot = bookings.filter(b => {
        const bookingStartHour = new Date(b.startTime).getHours();
        return bookingStartHour === hour;
      });
      
      timeSlotPopularity.push({
        timeSlot: `${startTime} - ${endTime}`,
        bookingCount: bookingsInSlot.length,
        popularity: bookings.length > 0 ? (bookingsInSlot.length / bookings.length) * 100 : 0
      });
    }
    
    res.json({
      fieldOccupancy,
      timeSlotPopularity,
      totalBookings: bookings.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getBusinessPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get high-level business metrics
    
    // Total bookings by month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    // Fix: Use proper SQL query to handle NULL values
    const bookingsByMonth = await prisma.$queryRaw<MonthlyStats[]>`
      SELECT 
        DATE_FORMAT(b.bookingDate, '%Y-%m') as month,
        COUNT(b.id) as bookings,
        COALESCE(SUM(p.amount), 0) as revenue
      FROM Booking b
      LEFT JOIN Payment p ON b.id = p.bookingId AND p.status = 'paid'
      WHERE b.bookingDate >= ${twelveMonthsAgo}
      GROUP BY DATE_FORMAT(b.bookingDate, '%Y-%m')
      ORDER BY month
    `;
    
    // Branch performance comparison
    const branchPerformance = await prisma.$queryRaw<BranchPerformance[]>`
      SELECT 
        br.name as branchName,
        br.id as branchId,
        COUNT(DISTINCT b.id) as totalBookings,
        COUNT(DISTINCT b.userId) as uniqueCustomers,
        COALESCE(SUM(p.amount), 0) as totalRevenue,
        CASE 
          WHEN COUNT(DISTINCT b.id) > 0 THEN COALESCE(SUM(p.amount), 0) / COUNT(DISTINCT b.id)
          ELSE 0
        END as averageBookingValue
      FROM Branch br
      LEFT JOIN Field f ON br.id = f.branchId
      LEFT JOIN Booking b ON f.id = b.fieldId
      LEFT JOIN Payment p ON b.id = p.bookingId AND p.status = 'paid'
      GROUP BY br.id, br.name
      ORDER BY totalRevenue DESC
    `;
    
    // Customer retention metrics - fix divide by zero errors
    const customerRetention = await prisma.$queryRaw<CustomerRetention[]>`
      SELECT 
        COUNT(DISTINCT userId) as totalCustomers,
        SUM(CASE WHEN bookingCount > 1 THEN 1 ELSE 0 END) as returningCustomers,
        CASE 
          WHEN COUNT(DISTINCT userId) > 0 THEN SUM(bookingCount) / COUNT(DISTINCT userId)
          ELSE 0
        END as avgBookingsPerCustomer
      FROM (
        SELECT 
          userId, 
          COUNT(id) as bookingCount 
        FROM Booking 
        GROUP BY userId
      ) as UserBookings
    `;
    
    // Current month vs previous month comparison
    const currentDate = new Date();
    const firstDayCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const firstDayPreviousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const lastDayPreviousMonth = new Date(firstDayCurrentMonth.getTime() - 1);
    
    const currentMonthStats = await prisma.$queryRaw<MonthStats[]>`
      SELECT 
        COUNT(b.id) as bookings,
        COALESCE(SUM(p.amount), 0) as revenue
      FROM Booking b
      LEFT JOIN Payment p ON b.id = p.bookingId AND p.status = 'paid'
      WHERE b.bookingDate >= ${firstDayCurrentMonth}
    `;
    
    const previousMonthStats = await prisma.$queryRaw<MonthStats[]>`
      SELECT 
        COUNT(b.id) as bookings,
        COALESCE(SUM(p.amount), 0) as revenue
      FROM Booking b
      LEFT JOIN Payment p ON b.id = p.bookingId AND p.status = 'paid'
      WHERE 
        b.bookingDate >= ${firstDayPreviousMonth} AND
        b.bookingDate < ${firstDayCurrentMonth}
    `;
    
    // Calculate growth rates with protection against divide by zero
    const currentMonth = currentMonthStats[0] || { bookings: 0, revenue: 0 };
    const previousMonth = previousMonthStats[0] || { bookings: 0, revenue: 0 };
    
    const bookingGrowth = previousMonth.bookings > 0 
      ? ((currentMonth.bookings - previousMonth.bookings) / previousMonth.bookings) * 100 
      : (currentMonth.bookings > 0 ? 100 : 0); // 100% growth if current > 0 and prev = 0
      
    const revenueGrowth = previousMonth.revenue > 0 
      ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100 
      : (currentMonth.revenue > 0 ? 100 : 0); // 100% growth if current > 0 and prev = 0
    
    res.json({
      bookingTrends: bookingsByMonth,
      branchPerformance,
      customerRetention: customerRetention[0] || { totalCustomers: 0, returningCustomers: 0, avgBookingsPerCustomer: 0 },
      monthComparison: {
        currentMonth,
        previousMonth,
        bookingGrowth,
        revenueGrowth
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Forecast future bookings and revenue
export const getBookingForecast = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get historical data for forecasting
    const historicalData = await prisma.$queryRaw<MonthlyStats[]>`
      SELECT 
        DATE_FORMAT(b.bookingDate, '%Y-%m') as month,
        COUNT(b.id) as bookings,
        COALESCE(SUM(p.amount), 0) as revenue
      FROM Booking b
      LEFT JOIN Payment p ON b.id = p.bookingId AND p.status = 'paid'
      GROUP BY DATE_FORMAT(b.bookingDate, '%Y-%m')
      ORDER BY month
    `;
    
    // Calculate average monthly growth with protection against bad data
    let totalBookingGrowth = 0;
    let totalRevenueGrowth = 0;
    let monthsWithData = 0;
    
    for (let i = 1; i < historicalData.length; i++) {
      const prevBookings = historicalData[i-1].bookings;
      const currBookings = historicalData[i].bookings;
      const prevRevenue = historicalData[i-1].revenue;
      const currRevenue = historicalData[i].revenue;
      
      if (prevBookings > 0 && prevRevenue > 0) {
        totalBookingGrowth += (currBookings - prevBookings) / prevBookings;
        totalRevenueGrowth += (currRevenue - prevRevenue) / prevRevenue;
        monthsWithData++;
      }
    }
    
    const avgBookingGrowth = monthsWithData > 0 ? totalBookingGrowth / monthsWithData : 0.05; // Default to 5% if no data
    const avgRevenueGrowth = monthsWithData > 0 ? totalRevenueGrowth / monthsWithData : 0.07; // Default to 7% if no data
    
    // Generate forecast for next 6 months
    const forecast: MonthlyStats[] = [];
    const lastMonth = historicalData.length > 0 
      ? historicalData[historicalData.length - 1] 
      : { month: getCurrentYearMonth(), bookings: 100, revenue: 5000 };
    
    let forecastBookings = lastMonth.bookings;
    let forecastRevenue = lastMonth.revenue;
    
    for (let i = 1; i <= 6; i++) {
      const forecastMonth = getNextMonth(lastMonth.month, i);
      
      forecastBookings = Math.round(forecastBookings * (1 + avgBookingGrowth));
      forecastRevenue = Math.round(forecastRevenue * (1 + avgRevenueGrowth));
      
      forecast.push({
        month: forecastMonth,
        bookings: forecastBookings,
        revenue: forecastRevenue,
        isProjection: true
      });
    }
    
    res.json({
      historicalData,
      forecast,
      growthMetrics: {
        avgMonthlyBookingGrowth: avgBookingGrowth * 100,
        avgMonthlyRevenueGrowth: avgRevenueGrowth * 100
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Helper function to get current year-month
function getCurrentYearMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

// Helper function to get future month
function getNextMonth(currentMonth: string, monthsToAdd: number): string {
  const [year, month] = currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + monthsToAdd);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}