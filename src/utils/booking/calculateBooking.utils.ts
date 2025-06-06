import { isWithinInterval } from 'date-fns';
import { combineDateAndTime } from '../../utils/date.utils';
import { BookingTime } from '../../types/booking';

/**
 * Combines a date with time string
 * @param date Base date
 * @param timeString Time in format "HH:mm"
 * @returns Combined date and time in UTC
 */
export const combineDateWithTime = (date: Date, timeString: string): Date => {
  console.log(`🧮 combineDateWithTime Input: date=${date}, time=${timeString}`);
  const result = combineDateAndTime(date, timeString);
  console.log(`🧮 combineDateWithTime Result: ${result} (${result.toISOString()})`);
  return result;
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
  startTime: BookingTime,
  endTime: BookingTime,
  dayPrice: number,
  nightPrice: number
): number => {
  console.log(`💰 Menghitung harga: dayPrice=${dayPrice}, nightPrice=${nightPrice}`);
  console.log(`💰 Start time: ${startTime} (${startTime.toISOString()})`);
  console.log(`💰 End time: ${endTime} (${endTime.toISOString()})`);

  // Daytime is considered from 06:00 to 18:00
  const bookingDate = startTime;

  // Create Date objects for day/night transition points
  const dayStart = combineDateAndTime(bookingDate, '06:00');
  const nightStart = combineDateAndTime(bookingDate, '18:00');

  console.log(`💰 Day start: ${dayStart} (${dayStart.toISOString()})`);
  console.log(`💰 Night start: ${nightStart} (${nightStart.toISOString()})`);

  // Duration in hours (convert milliseconds to hours)
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  console.log(`💰 Duration: ${durationHours} jam`);

  // Check if booking is entirely within daytime or nighttime
  const isEntirelyDaytime =
    isWithinInterval(startTime, { start: dayStart, end: nightStart }) &&
    isWithinInterval(endTime, { start: dayStart, end: nightStart });

  const isEntirelyNighttime =
    (startTime < dayStart && endTime < dayStart) ||
    (startTime >= nightStart && endTime >= nightStart);

  console.log(`💰 isEntirelyDaytime: ${isEntirelyDaytime}`);
  console.log(`💰 isEntirelyNighttime: ${isEntirelyNighttime}`);

  if (isEntirelyDaytime) {
    const price = dayPrice * durationHours;
    console.log(`💰 Hasil: ${price} (harga siang)`);
    return price;
  }

  if (isEntirelyNighttime) {
    const price = nightPrice * durationHours;
    console.log(`💰 Hasil: ${price} (harga malam)`);
    return price;
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
    dayHours +=
      (Math.min(endTime.getTime(), nightStart.getTime()) - startTime.getTime()) / (1000 * 60 * 60);

    // If booking extends to nighttime
    if (endTime > nightStart) {
      nightHours = (endTime.getTime() - nightStart.getTime()) / (1000 * 60 * 60);
    }
  } else {
    // Starts during night
    nightHours = durationHours;
  }

  const totalPrice = dayHours * dayPrice + nightHours * nightPrice;
  console.log(`💰 Hasil: ${totalPrice} (jam siang: ${dayHours}, jam malam: ${nightHours})`);
  return totalPrice;
};
