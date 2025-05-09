import { setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

// Tetapkan timezone WIB
export const TIMEZONE = 'Asia/Jakarta';

/**
 * Mengkonversi tanggal ke string format WIB
 * @param date Tanggal yang akan diformat
 * @returns String tanggal dalam format WIB
 */
export const formatDateToWIB = (date: Date): string => {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd HH:mm:ss xxxx');
};

/**
 * Mengkonversi tanggal ke awal hari dalam timezone WIB
 * @param date Tanggal yang akan dikonversi
 * @returns Date object yang menunjukkan awal hari dalam WIB
 */
export const getStartOfDayWIB = (date: Date): Date => {
  const zonedDate = toZonedTime(date, TIMEZONE);
  // Set jam, menit, detik, milidetik ke 0
  const startOfDay = setMilliseconds(setSeconds(setMinutes(setHours(zonedDate, 0), 0), 0), 0);
  // Tidak perlu konversi balik ke UTC karena Date selalu disimpan sebagai UTC
  return startOfDay;
};

/**
 * Membuat Date dengan jam tertentu dalam timezone WIB
 * @param baseDate Tanggal dasar
 * @param hour Jam yang diinginkan (0-23)
 * @returns Date object dengan jam yang ditentukan dalam WIB
 */
export const createDateWithHourWIB = (baseDate: Date, hour: number): Date => {
  const zonedDate = toZonedTime(baseDate, TIMEZONE);
  // Set jam spesifik dan reset menit, detik, milidetik
  const dateWithHour = setMilliseconds(setSeconds(setMinutes(setHours(zonedDate, hour), 0), 0), 0);
  // Tidak perlu konversi balik ke UTC karena Date selalu disimpan sebagai UTC
  return dateWithHour;
};

/**
 * Combine a date with a time string in WIB timezone
 * @param date The base date
 * @param timeString Time string in format "HH:mm"
 * @returns Date object with combined date and time in WIB
 */
export const combineDateWithTimeWIB = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const zonedDate = toZonedTime(date, TIMEZONE);
  return setMilliseconds(setSeconds(setMinutes(setHours(zonedDate, hours), minutes), 0), 0);
};
