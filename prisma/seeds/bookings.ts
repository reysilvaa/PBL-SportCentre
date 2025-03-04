import { PrismaClient } from "@prisma/client";

// seeds/bookings.ts
export default async function seedBookings(prisma: PrismaClient) {
    await prisma.booking.createMany({
      data: [{ userId: 1, fieldId: 1, bookingDate: new Date(), startTime: new Date(), endTime: new Date() }],
      skipDuplicates: true,
    });
  }
  