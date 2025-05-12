import { PrismaClient, PaymentMethod, PaymentStatus } from '@prisma/client';

export default async function seedPayments(prisma: PrismaClient) {
  // Ambil semua booking yang belum memiliki payment
  const bookings = await prisma.booking.findMany({
    where: {
      payment: null
    }
  });

  if (!bookings.length) {
    console.log('Tidak ada booking baru yang perlu dibuat payment');
    return 0;
  }

  // Array untuk menyimpan data pembayaran
  const paymentData = [];

  for (const booking of bookings) {
    // Acak metode pembayaran
    const paymentMethods = [PaymentMethod.midtrans, PaymentMethod.credit_card, PaymentMethod.ewallet, PaymentMethod.cash, PaymentMethod.transfer];
    const randomMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    
    // Acak status pembayaran - dengan distribusi: 70% paid, 20% pending, 10% failed/dp_paid
    const rand = Math.random();
    let paymentStatus;
    if (rand < 0.7) {
      paymentStatus = PaymentStatus.paid;
    } else if (rand < 0.9) {
      paymentStatus = PaymentStatus.pending;
    } else {
      paymentStatus = rand < 0.95 ? PaymentStatus.failed : PaymentStatus.dp_paid;
    }
    
    // Hitung jumlah pembayaran - antara 50rb - 300rb
    const amount = (Math.floor(Math.random() * 25) + 5) * 10000;
    
    // Transaction ID & Payment URL
    const transactionId = `TRX-${Date.now()}-${booking.id}`;
    const paymentUrl = `https://example.com/payment/${Date.now()}-${booking.id}`;
    
    // Tanggal kedaluwarsa - 24 jam dari sekarang
    const expiresDate = new Date(new Date().setHours(new Date().getHours() + 24));
    
    paymentData.push({
      bookingId: booking.id,
      userId: booking.userId,
      amount,
      paymentMethod: randomMethod,
      status: paymentStatus,
      transactionId,
      paymentUrl,
      expiresDate,
    });
  }

  // Buat payment di database
  const payments = await prisma.payment.createMany({
    data: paymentData,
    skipDuplicates: true,
  });

  return payments.count;
}
