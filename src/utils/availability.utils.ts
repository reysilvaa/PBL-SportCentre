import prisma from '../config/database';

export async function isFieldAvailable(
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const overlappingBookings = await prisma.booking.findMany({
    where: {
      fieldId,
      bookingDate: {
        equals: new Date(bookingDate.setHours(0, 0, 0, 0))
      },
      payment: {
        is: {
          status: {
            notIn: ['paid', 'dp_paid']
          }
        }
      },
      OR: [
        {
          startTime: { lte: endTime },
          endTime: { gt: startTime }
        },
        {
          startTime: { lt: endTime },
          endTime: { gte: startTime }
        },
        {
          startTime: { gte: startTime },
          endTime: { lte: endTime }
        },
        {
          startTime: { lte: startTime },
          endTime: { gte: endTime }
        }
      ]
    }
  });

  return overlappingBookings.length === 0;
}