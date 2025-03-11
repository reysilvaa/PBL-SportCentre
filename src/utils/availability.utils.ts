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

  console.log("🔍 Checking availability for Field ID:", fieldId);
  console.log("📆 Booking Date:", dateString);
  console.log("⏰ Start Time:", startTime, "| End Time:", endTime);

  // Find overlapping bookings with payment status 'paid', 'dp_paid' atau 'pending'
  const overlappingBookings = await prisma.booking.findMany({
    where: {
      fieldId,
      bookingDate: new Date(dateString), // Ensuring date format is correct
      AND: [
        {
          // Check bookings with payment not expired
          payment: {
            OR: [
              // Paid bookings
              {
                status: {
                  in: ['paid', 'dp_paid'], // Confirmed paid bookings
                },
              },
              // Pending bookings that haven't expired yet
              {
                status: 'pending',
                expiresDate: {
                  gt: new Date(), // Only consider non-expired pending bookings
                },
              }
            ]
          },
        },
        {
          OR: [
            // Case 1: New booking starts during an existing booking
            {
              startTime: { lte: startTime },
              endTime: { gt: startTime },
            },
            // Case 2: New booking ends during an existing booking
            {
              startTime: { lt: endTime },
              endTime: { gte: endTime },
            },
            // Case 3: New booking completely contains an existing booking
            {
              startTime: { gte: startTime },
              endTime: { lte: endTime },
            },
          ],
        },
      ],
    },
    include: {
      payment: true // Include the payment relation in the result
    }
  });

  console.log("📋 Overlapping bookings found:", overlappingBookings.length);
  
  if (overlappingBookings.length > 0) {
    console.log("⚠️ Detail booking yang overlapping:");
    overlappingBookings.forEach(booking => {
      console.log(`  - Booking #${booking.id}, status: ${booking.payment?.status}`);
    });
  }

  // If there are no overlapping bookings with successful payment or non-expired pending, field is available
  return overlappingBookings.length === 0;
};