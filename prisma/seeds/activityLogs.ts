import { PrismaClient } from "@prisma/client";

export default async function seedActivityLogs(prisma: PrismaClient) {
  // Get user
  const user = await prisma.user.findFirst({
    where: { role: "user" }
  });

  if (!user) {
    throw new Error("Required user not found");
  }

  const activityLogs = await prisma.activityLog.createMany({
    data: [
      {
        userId: user.id,
        action: "BOOKING_CREATED",
        details: "Created booking for Futsal Field A",
        ipAddress: "192.168.1.1",
        createdAt: new Date("2024-01-15T14:00:00Z")
      },
      {
        userId: user.id,
        action: "PAYMENT_COMPLETED",
        details: "Payment completed for booking #1",
        ipAddress: "192.168.1.1",
        createdAt: new Date("2024-01-15T14:05:00Z")
      },
      {
        userId: user.id,
        action: "REVIEW_SUBMITTED",
        details: "Submitted review for Futsal Field A",
        ipAddress: "192.168.1.1",
        createdAt: new Date("2024-01-15T18:00:00Z")
      }
    ],
    skipDuplicates: true,
  });

  return activityLogs.count;
  }