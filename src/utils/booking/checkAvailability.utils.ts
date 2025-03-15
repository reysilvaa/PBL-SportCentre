import prisma from '../../config/database';
import { 
  parseISO,
  addHours
} from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { 
  TIMEZONE, 
  formatDateToWIB, 
  getStartOfDayWIB,
  createDateWithHourWIB
} from '../../utils/variables/timezone.utils';

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
 * Checks if a field is available for booking at the specified time
 * @param fieldId Field ID to check
 * @param bookingDate The date of the booking
 * @param startTime Start time of the booking
 * @param endTime End time of the booking
 * @returns Boolean indicating field availability
 */
export const isFieldAvailable = async (
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date
): Promise<boolean> => {
  // Format the date part from bookingDate in WIB timezone
  const dateString = formatInTimeZone(bookingDate, TIMEZONE, 'yyyy-MM-dd');
  const baseDate = parseISO(dateString);

  console.log("🔍 Checking availability for Field ID:", fieldId);
  console.log("📆 Booking Date (WIB):", dateString);
  console.log("⏰ Start Time (WIB):", formatDateToWIB(startTime));
  console.log("⏰ End Time (WIB):", formatDateToWIB(endTime));

  // Find overlapping bookings with valid payment status
  const overlappingBookings = await prisma.booking.findMany({
    where: {
      fieldId,
      bookingDate: baseDate, // Tanggal dalam UTC, sesuai format DB

      // Check for any kind of time overlap
      OR: [
        // Case 1: New booking starts during an existing booking
        {
          startTime: { lte: startTime },
          endTime: { gt: startTime }
        },
        // Case 2: New booking ends during an existing booking
        {
          startTime: { lt: endTime },
          endTime: { gte: endTime }
        },
        // Case 3: New booking completely contains an existing booking
        {
          startTime: { gte: startTime },
          endTime: { lte: endTime }
        },
        // Case 4: Existing booking completely contains new booking
        {
          startTime: { lte: startTime },
          endTime: { gte: endTime }
        }
      ],

      // Only consider bookings with valid payment status
      payment: {
        OR: [
          // Paid or DP paid bookings (always valid)
          {
            status: {
              in: ['paid', 'dp_paid']
            }
          },
          // Pending bookings that haven't expired yet
          {
            status: 'pending',
            expiresDate: {
              gt: new Date() // Only consider non-expired pending bookings
            }
          }
        ]
      }
    },
    include: {
      payment: true,
      field: {
        include: {
          branch: true
        }
      }
    }    
  });

  console.log("📋 Overlapping bookings found:", overlappingBookings.length);

  if (overlappingBookings.length > 0) {
    console.log("⚠️ Detail booking yang overlapping:");
    overlappingBookings.forEach(booking => {
      const bookingStartWIB = formatDateToWIB(booking.startTime);
      const bookingEndWIB = formatDateToWIB(booking.endTime);
      console.log(`  - Booking #${booking.id}, status: ${booking.payment?.status}, expires: ${booking.payment?.expiresDate ? formatDateToWIB(booking.payment.expiresDate) : 'No expiry (manual booking)'}`);
      console.log(`    Time: ${bookingStartWIB} - ${bookingEndWIB}`);
    });
  }

  // If there are no overlapping bookings with valid payment status, field is available
  return overlappingBookings.length === 0;
};

/**
 * Gets all fields availability for the current day
 * @returns Array of field availability information
 */
export const getAllFieldsAvailability = async (): Promise<FieldAvailability[]> => {
  // Get today's date in WIB timezone, set to start of day
  const today = getStartOfDayWIB(new Date());

  // Generate hourly time slots for the entire day in WIB
  const hourlyTimeSlots = generateHourlyTimeSlots(today);

  // Fetch all fields from database
  const fields = await prisma.field.findMany({
    include: {
      branch: true,
    }
  });

  // Check availability for each field and each hourly slot
  const availabilityResults: FieldAvailability[] = [];

  for (const field of fields) {
    const fieldAvailability: FieldAvailability = {
      currentDate: toZonedTime(new Date(), TIMEZONE),
      fieldId: field.id,
      fieldName: field.name,
      branch: field.branch.name,
      isAvailable: false,
      availableTimeSlots: []
    };

    // Check each hourly slot
    for (const slot of hourlyTimeSlots) {
      const isSlotAvailable = await isFieldAvailable(
        field.id,
        today,
        slot.start,
        slot.end
      );

      if (isSlotAvailable) {
        fieldAvailability.availableTimeSlots?.push(slot);
      }
    }

    // Field is available if it has at least one available time slot
    fieldAvailability.isAvailable = (fieldAvailability.availableTimeSlots?.length || 0) > 0;
    
    availabilityResults.push(fieldAvailability);
  }

  return availabilityResults;
};

/**
 * Generates hourly time slots for a given date in WIB timezone
 * @param date The date to generate time slots for
 * @returns Array of hourly time slots
 */
export const generateHourlyTimeSlots = (date: Date): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  
  // Standard 24-hour coverage (00:00 to 24:00) in WIB
  for (let hour = 0; hour < 24; hour++) {
    const start = createDateWithHourWIB(date, hour);
    const end = createDateWithHourWIB(date, hour + 1);
    
    slots.push({ start, end });
  }

  return slots;
};

/**
 * Gets available time slots for a specific field on a specific date
 * @param fieldId Field ID to check
 * @param date The date to check
 * @returns Array of available time slots
 */
export const getAvailableTimeSlots = async (fieldId: number, date: Date): Promise<TimeSlot[]> => {
  // Convert date to WIB timezone for processing
  const zonedDate = toZonedTime(date, TIMEZONE);
  const dateString = formatInTimeZone(zonedDate, TIMEZONE, 'yyyy-MM-dd');
  
  // Konversi string tanggal kembali ke objek Date
  const dbDate = parseISO(dateString);
  
  console.log(`🔍 Mencari slot tersedia untuk lapangan #${fieldId} pada tanggal: ${dateString} (WIB)`);
  
  // Get all bookings for the field on the specified date (standard 24-hour day)
  const existingBookings = await prisma.booking.findMany({
    where: {
      fieldId: Number(fieldId),
      bookingDate: {
        equals: dbDate
      },
      payment: {
        status: {
          in: ['paid', 'dp_paid', 'pending']
        }
      }
    },
    select: {
      startTime: true,
      endTime: true,
      payment: {
        select: {
          status: true,
          expiresDate: true
        }
      }
    },
    orderBy: {
      startTime: 'asc'
    }
  });
  
  // Filter out expired pending bookings
  const validBookings = existingBookings.filter(booking => {
    if (booking.payment?.status === 'pending') {
      return booking.payment.expiresDate && booking.payment.expiresDate > new Date();
    }
    return true;
  });
  
  console.log(`📋 Ditemukan ${validBookings.length} booking valid pada tanggal tersebut`);
  
  // Get field opening hours in WIB (standard 24-hour day)
  const openingTime = createDateWithHourWIB(date, 0);  // 00:00 WIB
  const closingTime = createDateWithHourWIB(date, 24); // 24:00 WIB
  
  // Map bookings to time slots
  const bookedSlots = validBookings.map(booking => {
    const bookingStart = new Date(booking.startTime);
    const bookingEnd = new Date(booking.endTime);
    
    console.log(`  - Booking: ${formatDateToWIB(bookingStart)} - ${formatDateToWIB(bookingEnd)}`);
    
    return {
      start: bookingStart,
      end: bookingEnd
    };
  });
  
  const availableSlots = calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);
  
  console.log(`✅ Tersedia ${availableSlots.length} slot waktu:`);
  availableSlots.forEach((slot, index) => {
    console.log(`  ${index+1}. ${formatDateToWIB(slot.start)} - ${formatDateToWIB(slot.end)}`);
  });
  
  return availableSlots;
};

/**
 * Calculates available time slots based on opening hours and booked slots
 * @param openingTime Business opening time
 * @param closingTime Business closing time
 * @param bookedSlots Array of already booked time slots
 * @returns Array of available time slots
 */
export const calculateAvailableTimeSlots = (
  openingTime: Date, 
  closingTime: Date, 
  bookedSlots: TimeSlot[]
): TimeSlot[] => {
  if (bookedSlots.length === 0) {
    return [{ start: openingTime, end: closingTime }];
  }
  
  const sortedBookings = [...bookedSlots].sort((a, b) => 
    a.start.getTime() - b.start.getTime()
  );
  
  const availableSlots: TimeSlot[] = [];
  let currentTime = openingTime;
  
  for (const booking of sortedBookings) {
    if (currentTime < booking.start) {
      availableSlots.push({
        start: currentTime,
        end: booking.start
      });
    }
    currentTime = booking.end > currentTime ? booking.end : currentTime;
  }
  
  if (currentTime < closingTime) {
    availableSlots.push({
      start: currentTime,
      end: closingTime
    });
  }
  
  return availableSlots;
};