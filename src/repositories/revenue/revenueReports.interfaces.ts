// src/interfaces/RevenueReports.interface.ts

export interface RevenueData {
    date?: string;
    weekNumber?: number;
    weekStart?: Date;
    month?: string;
    revenue: number;
    bookings: number;
  }
  
  export interface BranchRevenue {
    branchName: string;
    branchId: number;
    revenue: number;
    bookings: number;
  }
  
  export interface FieldRevenue {
    fieldName: string;
    fieldId: number;
    branchName: string;
    revenue: number;
    bookings: number;
  }
  
  export interface TotalStats {
    totalRevenue: number;
    totalBookings: number;
  }
  
  export interface MonthlyStats {
    month: string;
    bookings: number;
    revenue: number;
    isProjection?: boolean;
  }
  
  export interface CustomerRetention {
    totalCustomers: number;
    returningCustomers: number;
    avgBookingsPerCustomer: number;
  }
  
  export interface BranchPerformance {
    branchName: string;
    branchId: number;
    totalBookings: number;
    uniqueCustomers: number;
    totalRevenue: number;
    averageBookingValue: number;
  }
  
  export interface MonthStats {
    bookings: number;
    revenue: number;
  }
  