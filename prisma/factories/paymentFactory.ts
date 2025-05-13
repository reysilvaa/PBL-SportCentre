import { PrismaClient, Payment, PaymentMethod, PaymentStatus } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';
import { Decimal } from '@prisma/client/runtime/library';

// Fungsi untuk menghasilkan payment tunggal
export const generatePayment = (
  bookingId: number,
  userId: number,
  amount: number,
  overrides: Partial<Payment> = {}
): Omit<Payment, 'id'> => {
  // Pilih metode pembayaran secara acak
  const paymentMethod = faker.helpers.arrayElement(Object.values(PaymentMethod));
  
  // Status pembayaran - sebagian besar sudah dibayar (70%), sebagian pending (20%), sebagian gagal (10%)
  let status;
  const statusRandom = faker.number.float({ min: 0, max: 1 });
  if (statusRandom < 0.7) {
    status = PaymentStatus.paid;
  } else if (statusRandom < 0.9) {
    status = PaymentStatus.pending;
  } else {
    status = PaymentStatus.failed;
  }
  
  // Tanggal kadaluarsa pembayaran (24 jam setelah dibuat)
  const expiresDate = new Date(overrides.createdAt || faker.date.past());
  expiresDate.setHours(expiresDate.getHours() + 24);
  
  // Generate transactionId dan paymentUrl untuk Midtrans
  let transactionId: string | null = null;
  let paymentUrl: string | null = null;
  
  if (paymentMethod === PaymentMethod.midtrans) {
    transactionId = `ORDER-${faker.string.alphanumeric(8).toUpperCase()}`;
    paymentUrl = `https://sandbox.midtrans.com/snap/v2/vtweb/${faker.string.alphanumeric(32)}`;
  }
  
  return {
    bookingId,
    userId,
    amount: overrides.amount || new Decimal(amount),
    paymentMethod,
    status: overrides.status || status,
    createdAt: overrides.createdAt || faker.date.past(),
    expiresDate: overrides.expiresDate || expiresDate,
    transactionId: overrides.transactionId !== undefined ? overrides.transactionId : transactionId,
    paymentUrl: overrides.paymentUrl !== undefined ? overrides.paymentUrl : paymentUrl,
  };
};

// Factory untuk menghasilkan payments untuk setiap booking
export const createPayments = async (
  prisma: PrismaClient,
  bookings: { id: number, userId: number, fieldId: number }[]
) => {
  console.log('Generating payments with faker...');
  
  // Hapus semua payments yang ada
  await prisma.payment.deleteMany({});
  
  const payments = [];
  
  // Ambil data fields untuk menentukan harga pembayaran
  const fieldIds = [...new Set(bookings.map(booking => booking.fieldId))];
  const fields = await prisma.field.findMany({
    where: { id: { in: fieldIds } },
    select: { id: true, priceDay: true, priceNight: true }
  });
  
  // Map untuk menyimpan harga field
  interface FieldPrice {
    day: number;
    night: number;
  }
  
  const fieldPrices: Record<number, FieldPrice> = {};
  fields.forEach(field => {
    fieldPrices[field.id] = {
      day: Number(field.priceDay),
      night: Number(field.priceNight)
    };
  });
  
  for (const booking of bookings) {
    // Ambil harga field berdasarkan jam
    const fieldPrice = fieldPrices[booking.fieldId];
    
    if (!fieldPrice) continue; // Skip jika field tidak ditemukan
    
    // Tentukan harga berdasarkan waktu (siang/malam)
    const bookingDetails = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: { startTime: true }
    });
    
    if (!bookingDetails) continue; // Skip jika booking tidak ditemukan
    
    const hour = bookingDetails.startTime.getHours();
    const isNight = hour >= 18 || hour < 6; // Malam hari: 18:00 - 06:00
    
    const price = isNight ? fieldPrice.night : fieldPrice.day;
    
    // Buat payment
    const payment = await prisma.payment.create({
      data: generatePayment(booking.id, booking.userId, price)
    });
    
    payments.push(payment);
  }
  
  console.log(`Generated ${payments.length} payments.`);
  
  return payments;
}; 