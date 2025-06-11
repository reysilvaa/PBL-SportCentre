import prisma from '../../config/services/database';
import { generateHourlyTimeSlots } from './generateHourlyTimeSlots.utils';
import { BookingStatus } from '../../types/enums';

// Types
type TimeSlot = { start: Date; end: Date };
type FieldAvailability = {
  fieldId: number;
  fieldName: string;
  branch: string;
  isAvailable: boolean;
  availableTimeSlots?: TimeSlot[];
  currentDate?: Date;
};

/**
 * Memeriksa overlap antara dua time slot
 * Note: end time selalu exclusive (tidak termasuk dalam booking)
 * Contoh: booking 8:00-10:00 berarti dari 8:00 sampai 9:59:59.999
 * Artinya jam 10:00 sudah bisa dibooking oleh user lain
 */
const isOverlapping = (slot1: TimeSlot, slot2: TimeSlot): boolean => {
  // Waktu akhir bersifat exclusive - user A yang booking 8:00-10:00 
  // seharusnya tidak bentrok dengan user B yang booking 10:00-12:00
  return (
    (slot1.start < slot2.end && slot1.end > slot2.start) && // Terdapat overlap waktu
    !(slot1.end.getTime() === slot2.start.getTime()) // Kecuali jika end time pertama = start time kedua
  );
};

/**
 * Mencari booking yang valid berdasarkan status payment
 * PENTING: Metode ini mencari booking yang menempati slot waktu tertentu
 * Perhatikan bahwa endTime bersifat exclusive (tidak termasuk dalam booking)
 */
const getValidBookings = async (fieldId: number, date: Date, timeSlot?: TimeSlot) => {
  // Create date range for the entire day to avoid timezone issues
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // console.log(
  //   // 'Searching for bookings between:',
  //   startOfDay.toISOString(),
  //   'and',
  //   endOfDay.toISOString()
  // );

  const whereClause: any = {
    fieldId,
    // Use date range instead of exact equality
    bookingDate: {
      gte: startOfDay,
      lte: endOfDay,
    },
    // Hanya cek booking dengan status ACTIVE
    status: BookingStatus.ACTIVE,
    payments: {
      some: {
        OR: [
          { status: { in: ['paid', 'dp_paid'] } },
          { status: 'pending', expiresDate: { gt: new Date() } },
        ],
      }
    },
  };

  // Jika timeSlot tersedia, tambahkan kondisi overlap
  if (timeSlot) {
    // PENTING: Cara booking overlap:
    // 1. Booking lama mulai sebelum/saat booking baru mulai, dan selesai setelah booking baru mulai
    // 2. Booking lama mulai sebelum booking baru selesai, dan selesai saat/setelah booking baru selesai
    // 3. Booking lama mulai saat/setelah booking baru mulai, dan selesai saat/sebelum booking baru selesai
    // 4. Booking lama mulai sebelum booking baru mulai, dan selesai setelah booking baru selesai
    // PENGECUALIAN: booking 8:00-10:00 tidak bentrok dengan 10:00-12:00
    whereClause.OR = [
      { startTime: { lte: timeSlot.start }, endTime: { gt: timeSlot.start } },
      { startTime: { lt: timeSlot.end }, endTime: { gte: timeSlot.end } },
      { startTime: { gte: timeSlot.start }, endTime: { lte: timeSlot.end } },
      { startTime: { lte: timeSlot.start }, endTime: { gte: timeSlot.end } },
    ];
  }

  // Execute the final query with all conditions
  return prisma.booking.findMany({
    where: whereClause,
    include: {
      payments: true,
      field: {
        include: {
          branch: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });
};

/**
 * Menghitung slot waktu yang tersedia berdasarkan waktu buka, tutup, dan booking yang ada
 * PENTING: endTime bersifat exclusive, artinya booking 08:00-10:00 berarti
 * jam 10:00 sudah bisa digunakan untuk booking berikutnya
 */
export const calculateAvailableTimeSlots = (
  openingTime: Date,
  closingTime: Date,
  bookedSlots: TimeSlot[]
): TimeSlot[] => {
  if (bookedSlots.length === 0) {
    return [{ start: openingTime, end: closingTime }];
  }

  // Sort bookings by start time
  const sortedBookings = [...bookedSlots].sort((a, b) => a.start.getTime() - b.start.getTime());

  const availableSlots: TimeSlot[] = [];
  let currentTime = openingTime;

  for (const booking of sortedBookings) {
    // Jika ada gap antara currentTime dan waktu mulai booking, tambahkan sebagai slot tersedia
    if (currentTime < booking.start) {
      availableSlots.push({
        start: currentTime,
        end: booking.start,
      });
    }
    
    // Update currentTime ke waktu akhir booking jika lebih besar dari currentTime
    // Ingat: endTime bersifat exclusive, sehingga tidak perlu melakukan penyesuaian
    currentTime = booking.end > currentTime ? booking.end : currentTime;
  }

  // Jika masih ada waktu tersisa setelah booking terakhir hingga waktu tutup
  if (currentTime < closingTime) {
    availableSlots.push({
      start: currentTime,
      end: closingTime,
    });
  }

  return availableSlots;
};

/**
 * Memeriksa ketersediaan lapangan pada waktu tertentu
 * PENTING: Fungsi ini menggunakan waktu yang sama untuk perbandingan konsisten
 * Semua waktu dalam UTC
 */
export const isFieldAvailable = async (
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date
): Promise<boolean> => {
  // console.log('🔍 Checking availability for Field ID:', fieldId);
  console.log('📆 Booking Date:', bookingDate.toISOString());
  console.log('⏰ Start Time:', startTime.toISOString());
  console.log('⏰ End Time:', endTime.toISOString());

  const timeSlot = { start: startTime, end: endTime };
  const overlappingBookings = await getValidBookings(fieldId, bookingDate, timeSlot);

  console.log('📋 Overlapping bookings found:', overlappingBookings.length);

  if (overlappingBookings.length > 0) {
    console.log('⚠️ Detail booking yang overlapping:');
    overlappingBookings.forEach((booking) => {
      console.log(
        `  - Booking #${booking.id}, status: ${booking.status}, payment: ${booking.payments[0]?.status}, expires: ${booking.payments[0]?.expiresDate ? booking.payments[0].expiresDate : 'No expiry'}`
      );
      console.log(`    Time (UTC): ${booking.startTime.toISOString()} - ${booking.endTime.toISOString()}`);
    });
  }

  return overlappingBookings.length === 0;
};

/**
 * Mendapatkan ketersediaan semua lapangan untuk tanggal tertentu
 */
export const getAllFieldsAvailability = async (selectedDate?: string): Promise<FieldAvailability[]> => {
  // Gunakan tanggal yang dipilih, atau tanggal hari ini jika tidak ada yang dipilih
  const date = selectedDate ? new Date(selectedDate) : new Date();
  
  // Set ke awal hari
  date.setHours(0, 0, 0, 0);
  const hourlyTimeSlots = generateHourlyTimeSlots(date);
  const fields = await prisma.field.findMany({
    include: { branch: true },
  });

  const availabilityResults: FieldAvailability[] = [];

  for (const field of fields) {
    const fieldAvailability: FieldAvailability = {
      currentDate: date,
      fieldId: field.id,
      fieldName: field.name,
      branch: field.branch.name,
      isAvailable: false,
      availableTimeSlots: [],
    };

    // Dapatkan semua booking valid untuk field ini pada tanggal yang dipilih
    const validBookings = await getValidBookings(field.id, date);
    const bookedSlots = validBookings.map((booking) => ({
      start: new Date(booking.startTime),
      end: new Date(booking.endTime),
    }));
    
    // Periksa setiap slot per jam
    for (const slot of hourlyTimeSlots) {
      const isOverlap = bookedSlots.some((bookedSlot) => isOverlapping(slot, bookedSlot));

      if (!isOverlap) {
        fieldAvailability.availableTimeSlots?.push(slot);
      }
    }

    fieldAvailability.isAvailable = (fieldAvailability.availableTimeSlots?.length || 0) > 0;
    availabilityResults.push(fieldAvailability);
  }

  return availabilityResults;
};

/**
 * Mendapatkan slot waktu yang tersedia untuk field tertentu pada tanggal tertentu
 * CATATAN PENTING: 
 * - endTime bersifat exclusive
 * - booking 08:00-10:00 berarti jam 10:00 sudah tersedia untuk booking berikutnya
 * - dalam UI, jam 08:00-09:00 akan ditampilkan sebagai "terpesan" dan jam 10:00 akan tersedia
 */
export const getAvailableTimeSlots = async (fieldId: number, date: Date): Promise<TimeSlot[]> => {
  // Set tanggal ke awal hari
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  console.log(
    `🔍 Mencari slot tersedia untuk lapangan #${fieldId} pada tanggal: ${targetDate.toISOString().split('T')[0]}`
  );

  // Dapatkan semua booking valid untuk field ini pada tanggal tersebut
  const validBookings = await getValidBookings(Number(fieldId), targetDate);

  console.log(`📋 Ditemukan ${validBookings.length} booking valid pada tanggal tersebut`);

  // Tetapkan jam buka dan tutup (24 jam)
  const openingTime = new Date(targetDate);
  openingTime.setHours(0, 0, 0, 0);

  const closingTime = new Date(targetDate);
  closingTime.setHours(24, 0, 0, 0);

  // Map booking ke time slots
  const bookedSlots = validBookings.map((booking) => {
    return {
      start: new Date(booking.startTime),
      end: new Date(booking.endTime)
    };
  });

  // Log bookedSlots untuk debugging
  console.log('Booked slots:');
  bookedSlots.forEach((slot, index) => {
    console.log(`${index + 1}. ${slot.start.toISOString()} - ${slot.end.toISOString()}`);
  });

  // Hitung slot yang tersedia
  return calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);
};

// Expose private functions for testing
export const __test__ = {
  isOverlapping,
};
