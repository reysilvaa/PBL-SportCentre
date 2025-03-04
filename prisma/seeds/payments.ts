import { PrismaClient } from "@prisma/client";

// seeds/payments.ts
export default async function seedPayments(prisma: PrismaClient) {
    await prisma.payment.createMany({
      data: [{ bookingId: 1, userId: 1, amount: 50000, paymentMethod: "cash" }],
      skipDuplicates: true,
    });
  }
  