import prisma from '../../config/services/database';

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
 */
const isOverlapping = (slot1: TimeSlot, slot2: TimeSlot): boolean => {
  return (
    (slot1.start <= slot2.start && slot1.end > slot2.start) || // Kasus 1
    (slot1.start < slot2.end && slot1.end >= slot2.end) || // Kasus 2
    (slot1.start >= slot2.start && slot1.end <= slot2.end) || // Kasus 3
    (slot1.start <= slot2.start && slot1.end >= slot2.end) // Kasus 4
  );
};

/**
 * Mencari booking yang valid berdasarkan status payment
 */
const getValidBookings = async (fieldId: number, date: Date, timeSlot?: TimeSlot) => {
  // Create date range for the entire day to avoid timezone issues
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  console.log(
    'Searching for bookings between:',
    startOfDay.toISOString(),
    'and',
    endOfDay.toISOString()
  );

  const whereClause: any = {
    fieldId,
    // Use date range instead of exact equality
    bookingDate: {
      gte: startOfDay,
      lte: endOfDay,
    },
    payment: {
      OR: [
        { status: { in: ['paid', 'dp_paid'] } },
        { status: 'pending', expiresDate: { gt: new Date() } },
      ],
    },
  };

  // Jika timeSlot tersedia, tambahkan kondisi overlap
  if (timeSlot) {
    whereClause.OR = [
      { startTime: { lte: timeSlot.start }, endTime: { gt: timeSlot.start } },
      { startTime: { lt: timeSlot.end }, endTime: { gte: timeSlot.end } },
      { startTime: { gte: timeSlot.start }, endTime: { lte: timeSlot.end } },
      { startTime: { lte: timeSlot.start }, endTime: { gte: timeSlot.end } },
    ];
  }

  // Debug - Show all bookings for this field regardless of date
  const debugQuery = await prisma.booking.findMany({
    where: { fieldId },
    include: { payment: true },
  });

  console.log('ALL bookings for field regardless of date:', debugQuery.length);

  if (debugQuery.length > 0) {
    console.log(
      'First few bookings:',
      debugQuery.slice(0, 3).map((b) => ({
        id: b.id,
        fieldId: b.fieldId,
        date: b.bookingDate,
        start: b.startTime,
        end: b.endTime,
      }))
    );

    // Debug - Payment status
    debugQuery.forEach((booking) => {
      console.log(
        `Booking #${booking.id} payment:`,
        booking.payment
          ? {
              status: booking.payment.status,
              expires: booking.payment.expiresDate,
            }
          : 'No payment record'
      );
    });

    // Debug - Date comparison
    console.log('Date comparison:');
    console.log('Query start date:', startOfDay.toISOString());
    console.log('Query end date:', endOfDay.toISOString());
    console.log('Booking date:', debugQuery[0].bookingDate.toISOString());

    // Try a direct query with the exact booking date
    const directQuery = await prisma.booking.findMany({
      where: {
        fieldId,
        bookingDate: debugQuery[0].bookingDate,
      },
    });
    console.log('Direct query with exact bookingDate:', directQuery.length);
  }

  // Execute the final query with all conditions
  return prisma.booking.findMany({
    where: whereClause,
    include: {
      payment: true,
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
 * Menghasilkan time slot per jam untuk satu hari penuh
 */
const generateHourlyTimeSlots = (date: Date): TimeSlot[] => {
  const slots: TimeSlot[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);

    const end = new Date(date);
    end.setHours(hour + 1, 0, 0, 0);

    slots.push({ start, end });
  }

  return slots;
};

/**
 * Menghitung slot waktu yang tersedia berdasarkan waktu buka, tutup, dan booking yang ada
 */
export const calculateAvailableTimeSlots = (
  openingTime: Date,
  closingTime: Date,
  bookedSlots: TimeSlot[]
): TimeSlot[] => {
  if (bookedSlots.length === 0) {
    return [{ start: openingTime, end: closingTime }];
  }

  const sortedBookings = [...bookedSlots].sort((a, b) => a.start.getTime() - b.start.getTime());

  const availableSlots: TimeSlot[] = [];
  let currentTime = openingTime;

  for (const booking of sortedBookings) {
    if (currentTime < booking.start) {
      availableSlots.push({
        start: currentTime,
        end: booking.start,
      });
    }
    currentTime = booking.end > currentTime ? booking.end : currentTime;
  }

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
 */
export const isFieldAvailable = async (
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date
): Promise<boolean> => {
  console.log('🔍 Checking availability for Field ID:', fieldId);
  console.log('📆 Booking Date:', bookingDate);
  console.log('⏰ Start Time:', startTime);
  console.log('⏰ End Time:', endTime);

  const timeSlot = { start: startTime, end: endTime };
  const overlappingBookings = await getValidBookings(fieldId, bookingDate, timeSlot);

  console.log('📋 Overlapping bookings found:', overlappingBookings.length);

  if (overlappingBookings.length > 0) {
    console.log('⚠️ Detail booking yang overlapping:');
    overlappingBookings.forEach((booking) => {
      console.log(
        `  - Booking #${booking.id}, status: ${booking.payment?.status}, expires: ${booking.payment?.expiresDate ? booking.payment.expiresDate : 'No expiry'}`
      );
      console.log(`    Time: ${booking.startTime} - ${booking.endTime}`);
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
  
  console.log('🔍 Checking availability for date:', date.toISOString().split('T')[0]);

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
    
    // Inside getAllFieldsAvailability, before checking hourly slots:
    console.log(`All valid bookings for field ${field.id} on date ${date.toISOString().split('T')[0]}:`, 
      validBookings.map((b) => ({
        id: b.id,
        date: b.bookingDate,
        start: b.startTime,
        end: b.endTime,
        paymentStatus: b.payment?.status,
        expires: b.payment?.expiresDate,
      }))
    );

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
    const bookingStart = new Date(booking.startTime);
    const bookingEnd = new Date(booking.endTime);

    console.log(
      `  - Booking: ${bookingStart.toLocaleTimeString()} - ${bookingEnd.toLocaleTimeString()}`
    );

    return {
      start: bookingStart,
      end: bookingEnd,
    };
  });

  const availableSlots = calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);

  console.log(`✅ Tersedia ${availableSlots.length} slot waktu:`);
  availableSlots.forEach((slot, index) => {
    console.log(
      `  ${index + 1}. ${slot.start.toLocaleTimeString()} - ${slot.end.toLocaleTimeString()}`
    );
  });

  return availableSlots;
};
