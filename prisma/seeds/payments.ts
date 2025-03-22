import { PrismaClient, PaymentMethod, PaymentStatus } from "@prisma/client";

export default async function seedPayments(prisma: PrismaClient) {
  // Get user and bookings
  const user = await prisma.user.findFirst({
    where: { role: "user" }
  });

  const bookings = await prisma.booking.findMany();

  if (!user || !bookings.length) {
    throw new Error("Required user and bookings not found");
  }

  const payments = await prisma.payment.createMany({
    data: bookings.map((booking, index) => ({
      bookingId: booking.id,
      userId: user.id,
      amount: index === 0 ? 200000 : index === 1 ? 180000 : 100000,
      paymentMethod: index === 0 ? PaymentMethod.midtrans : 
                     index === 1 ? PaymentMethod.credit_card : 
                     PaymentMethod.ewallet,
      status: index === 0 ? PaymentStatus.paid :
              index === 1 ? PaymentStatus.pending :
              PaymentStatus.dp_paid,
      transactionId: `TRX-${Date.now()}-${index + 1}`,
      paymentUrl: `https://example.com/payment/${Date.now()}-${index + 1}`,
      expiresDate: new Date(new Date().setHours(new Date().getHours() + 24))
    })),
    skipDuplicates: true,
  });

  return payments.count;
  }
  