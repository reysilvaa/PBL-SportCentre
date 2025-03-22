import { PrismaClient } from "@prisma/client";

export default async function seedBookings(prisma: PrismaClient) {
  // Get regular user
  const user = await prisma.user.findFirst({
    where: { role: "user" }
  });

  // Get available fields
  const fields = await prisma.field.findMany();

  if (!user || !fields.length) {
    throw new Error("Required user and fields not found");
  }

  // Create bookings for different dates and times
  const bookings = await prisma.booking.createMany({
    data: [
      {
        userId: user.id,
        fieldId: fields[0].id,
        bookingDate: new Date("2024-01-15"),
        startTime: new Date("2024-01-15T14:00:00Z"),
        endTime: new Date("2024-01-15T16:00:00Z")
      },
      {
        userId: user.id,
        fieldId: fields[1].id,
        bookingDate: new Date("2024-01-16"),
        startTime: new Date("2024-01-16T19:00:00Z"),
        endTime: new Date("2024-01-16T21:00:00Z")
      },
      {
        userId: user.id,
        fieldId: fields[2].id,
        bookingDate: new Date("2024-01-17"),
        startTime: new Date("2024-01-17T08:00:00Z"),
        endTime: new Date("2024-01-17T10:00:00Z")
      }
    ],
    skipDuplicates: true,
  });

  return bookings.count;
  }
  