export class DateUtils {
  // Format date as YYYY-MM
  static formatYearMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  // Get current year-month
  static getCurrentYearMonth(): string {
    const date = new Date();
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  // Get future month
  static getNextMonth(currentMonth: string, monthsToAdd: number): string {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + monthsToAdd);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  // Get year-week format
  static getYearWeek(date: Date): string {
    // Get ISO week number
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week =
      Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 4).getTime()) / 86400000 / 7) + 1;
    return `${d.getFullYear()}-${String(week).padStart(2, '0')}`;
  }

  // Get week start (Monday)
  static getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  // Get week end (Sunday)
  static getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekEnd;
  }

  // Format date as YYYY-MM-DD
  static formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // Parse YYYY-MM-DD string to Date
  static parseDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Get date range between two dates
  static getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  // Get months between two dates
  static getMonthsBetween(startDate: Date, endDate: Date): string[] {
    const months: string[] = [];
    const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const lastDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (currentDate <= lastDate) {
      months.push(this.formatYearMonth(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
  }

  // Check if date is today
  static isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  // Add days to date
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Format date as ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
  static toISOString(date: Date): string {
    return date.toISOString();
  }

  // Get quarter from date (1-4)
  static getQuarter(date: Date): number {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  // Format date as YYYY-Q (year-quarter)
  static formatYearQuarter(date: Date): string {
    return `${date.getFullYear()}-Q${this.getQuarter(date)}`;
  }
}
