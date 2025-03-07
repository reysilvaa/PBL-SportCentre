import prisma from '../config/database';

export async function isFieldAvailable(
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const normalizedBookingDate = new Date(bookingDate);
  normalizedBookingDate.setHours(0, 0, 0, 0); // Pastikan hanya tanggal yang digunakan

  const overlappingBookings = await prisma.booking.findMany({
    where: {
      fieldId: Number(fieldId), // Pastikan fieldId berupa number
      bookingDate: {
        equals: normalizedBookingDate, // Gunakan booking date yang distandarisasi
      },
      payment: {
        is: {
          status: {
            notIn: ['paid', 'dp_paid'],
          },
        },
      },
      OR: [
        {
          startTime: { lte: endTime },
          endTime: { gt: startTime },
        },
        {
          startTime: { lt: endTime },
          endTime: { gte: startTime },
        },
        {
          startTime: { gte: startTime },
          endTime: { lte: endTime },
        },
        {
          startTime: { lte: startTime },
          endTime: { gte: endTime },
        },
      ],
    },
  });

  return overlappingBookings.length === 0;
}
