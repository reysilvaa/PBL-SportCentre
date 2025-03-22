import { PrismaClient } from '@prisma/client';

export default async function seedNotifications(prisma: PrismaClient) {
  // Get user and bookings
  const user = await prisma.user.findFirst({
    where: { role: 'user' },
  });

  const bookings = await prisma.booking.findMany();

  if (!user || !bookings.length) {
    throw new Error('Required user and bookings not found');
  }

  const notifications = await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        title: 'Booking Confirmed',
        message:
          'Your booking for Futsal Field A has been confirmed. Please complete the payment.',
        type: 'BOOKING_CONFIRMATION',
        linkId: bookings[0].id.toString(),
        createdAt: new Date('2024-01-15T14:01:00Z'),
      },
      {
        userId: user.id,
        title: 'Payment Successful',
        message:
          'Payment for your booking has been received. Get ready for your game!',
        type: 'PAYMENT_SUCCESS',
        linkId: bookings[0].id.toString(),
        createdAt: new Date('2024-01-15T14:06:00Z'),
      },
      {
        userId: user.id,
        title: 'Upcoming Booking Reminder',
        message: 'Reminder: You have a booking tomorrow at Basketball Court 1.',
        type: 'BOOKING_REMINDER',
        linkId: bookings[1].id.toString(),
        createdAt: new Date('2024-01-15T10:00:00Z'),
      },
    ],
    skipDuplicates: true,
  });

  return notifications.count;
}
