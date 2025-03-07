import prisma from '../config/database';

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
  // Format the date part from bookingDate
  const dateString = bookingDate.toISOString().split('T')[0];
  
  // Find any overlapping bookings
  const overlappingBookings = await prisma.booking.findMany({
    where: {
      fieldId,
      bookingDate: {
        equals: new Date(dateString)
      },
        payment: {
          status: {
            notIn: ['paid', 'dp_paid']
          }
        },
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
        }
      ]
    }
  });
  
  return overlappingBookings.length === 0;
};