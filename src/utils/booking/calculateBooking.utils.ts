import { isWithinInterval } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { combineDateWithTimeWIB, TIMEZONE } from '../../utils/variables/timezone.utils';

/**
 * Combines a date with time string
 * @param date Base date
 * @param timeString Time in format "HH:mm"
 * @returns Combined date and time
 */
export const combineDateWithTime = (date: Date, timeString: string): Date => {
  return combineDateWithTimeWIB(date, timeString);
};

/**
 * Calculates total price based on booking time
 * @param startTime Booking start time
 * @param endTime Booking end time
 * @param dayPrice Price during daytime
 * @param nightPrice Price during nighttime
 * @returns Total price for the booking
 */
export const calculateTotalPrice = (
  startTime: Date,
  endTime: Date,
  dayPrice: number,
  nightPrice: number
): number => {
  // Daytime is considered from 06:00 to 18:00 WIB
  const bookingDate = startTime;
  const dateStr = formatInTimeZone(bookingDate, TIMEZONE, 'yyyy-MM-dd');
  
  // Create Date objects for day/night transition points
  const dayStart = combineDateWithTimeWIB(bookingDate, '06:00');
  const nightStart = combineDateWithTimeWIB(bookingDate, '18:00');
  
  // Duration in hours (convert milliseconds to hours)
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  
  // Check if booking is entirely within daytime or nighttime
  const isEntirelyDaytime = isWithinInterval(startTime, { start: dayStart, end: nightStart }) &&
                           isWithinInterval(endTime, { start: dayStart, end: nightStart });
  
  const isEntirelyNighttime = (startTime < dayStart && endTime < dayStart) ||
                             (startTime >= nightStart && endTime >= nightStart);
  
  if (isEntirelyDaytime) {
    return dayPrice * durationHours;
  }
  
  if (isEntirelyNighttime) {
    return nightPrice * durationHours;
  }
  
  // If booking spans day and night, calculate separately
  let dayHours = 0;
  let nightHours = 0;
  
  if (startTime < dayStart) {
    // Starts at night, calculate until dayStart
    nightHours += (dayStart.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    if (endTime <= nightStart) {
      // Ends before nighttime
      dayHours = (endTime.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
    } else {
      // Continues into night again
      dayHours = (nightStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
      nightHours += (endTime.getTime() - nightStart.getTime()) / (1000 * 60 * 60);
    }
  } else if (startTime >= dayStart && startTime < nightStart) {
    // Starts during day, calculate until nightStart
    dayHours += (Math.min(endTime.getTime(), nightStart.getTime()) - startTime.getTime()) / (1000 * 60 * 60);
    
    // If booking extends to nighttime
    if (endTime > nightStart) {
      nightHours = (endTime.getTime() - nightStart.getTime()) / (1000 * 60 * 60);
    }
  } else {
    // Starts during night
    nightHours = durationHours;
  }
  
  return (dayHours * dayPrice) + (nightHours * nightPrice);
};