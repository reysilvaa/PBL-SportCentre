/**
 * Utilitas untuk menangani tanggal dan waktu
 * PENTING: Semua operasi tanggal di backend menggunakan UTC
 */

/**
 * Menggabungkan tanggal dengan string waktu dalam format UTC
 * @param date Tanggal dasar
 * @param timeString String waktu dalam format "HH:mm"
 * @returns Date object dengan tanggal dan waktu yang digabungkan dalam UTC
 */
export const combineDateAndTime = (date: Date, timeString: string): Date => {
  console.log(`⚙️ Input: date=${date}, time=${timeString}`);
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Buat tanggal baru dengan komponen yang sama tapi waktu yang berbeda
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
  
  console.log(`⚙️ Hasil: ${result} (${result.toISOString()})`);
  console.log(`⚙️ Lokal: ${result.getHours()}:${result.getMinutes()}`);
  return result;
};

/**
 * Mengatur waktu ke awal hari dalam UTC
 * @param date Tanggal yang akan dikonversi
 * @returns Date object yang menunjukkan awal hari dalam UTC
 */
export const getStartOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Mengatur waktu ke akhir hari dalam UTC
 * @param date Tanggal yang akan dikonversi
 * @returns Date object yang menunjukkan akhir hari dalam UTC
 */
export const getEndOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

/**
 * Membuat Date dengan jam tertentu dalam UTC
 * @param baseDate Tanggal dasar
 * @param hour Jam yang diinginkan (0-23)
 * @returns Date object dengan jam yang ditentukan dalam UTC
 */
export const createDateWithHour = (baseDate: Date, hour: number): Date => {
  const result = new Date(baseDate);
  result.setHours(hour, 0, 0, 0);
  return result;
};

/**
 * Format tanggal untuk database (ISO string)
 * @param date Tanggal yang akan diformat
 * @returns String tanggal dalam format ISO
 */
export const formatForDatabase = (date: Date): string => {
  return date.toISOString();
}; 