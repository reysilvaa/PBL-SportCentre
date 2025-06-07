import { PrismaClient, Payment, PaymentStatus, PaymentMethod } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';
import { Decimal } from '@prisma/client/runtime/library';

// Definisi enum PaymentMethod secara manual untuk kebutuhan factory


// Fungsi untuk menghasilkan payment tunggal
export const generatePayment = (
  bookingId: number,
  userId: number,
  amount: number,
  bookingDate: Date,
  overrides: Partial<Payment> = {}
): Omit<Payment, 'id'> => {
  // Metode pembayaran dengan distribusi yang lebih realistis
  // Data menunjukkan bahwa di Indonesia transfer dan e-wallet lebih populer
  const paymentMethodWeights = [
    { value: PaymentMethod.bca_va, weight: 15 },    // 15% BCA VA
    { value: PaymentMethod.gopay, weight: 20 },     // 20% GoPay
    { value: PaymentMethod.shopeepay, weight: 15 }, // 15% ShopeePay
    { value: PaymentMethod.qris, weight: 10 },      // 10% QRIS
    { value: PaymentMethod.bni_va, weight: 10 },    // 10% BNI VA
    { value: PaymentMethod.bri_va, weight: 5 },     // 5% BRI VA
    { value: PaymentMethod.credit_card, weight: 10 }, // 10% Credit Card
    { value: PaymentMethod.cash, weight: 15 }         // 15% Cash
  ];

  const paymentMethod = overrides.paymentMethod || 
    faker.helpers.weightedArrayElement(paymentMethodWeights);
  
  // Tanggal pembayaran
  // Untuk booking masa lalu, payment dibuat 0-7 hari sebelum booking date
  // Untuk booking masa depan, payment dibuat pada waktu acak sebelum hari ini
  const now = new Date();
  let createdAt;
  
  if (bookingDate < now) {
    // Booking masa lalu
    createdAt = new Date(bookingDate);
    createdAt.setDate(createdAt.getDate() - faker.number.int({ min: 0, max: 7 }));
  } else {
    // Booking masa depan
    createdAt = overrides.createdAt || faker.date.recent({ days: 14 });
  }
  
  // Status pembayaran dengan pola yang realistis
  // Pola status pembayaran bervariasi berdasarkan metode dan tanggal
  let status;
  
  // Untuk booking di masa lalu, sebagian besar sudah dibayar
  if (bookingDate < now) {
    // 85% paid, 5% failed, 10% pending untuk booking di masa lalu
    const statusRoll = faker.number.float({ min: 0, max: 1 });
    if (statusRoll < 0.85) {
      status = PaymentStatus.paid;
    } else if (statusRoll < 0.9) {
      status = PaymentStatus.failed;
    } else {
      status = PaymentStatus.pending;
    }
  } else {
    // Untuk booking masa depan, distribusinya berbeda
    // 50% paid, 40% pending, 10% failed
    const statusRoll = faker.number.float({ min: 0, max: 1 });
    if (statusRoll < 0.5) {
      status = PaymentStatus.paid;
    } else if (statusRoll < 0.9) {
      status = PaymentStatus.pending;
    } else {
      status = PaymentStatus.failed;
    }
  }
  
  // Tanggal kadaluarsa pembayaran (24 jam setelah dibuat)
  const expiresDate = new Date(createdAt);
  expiresDate.setHours(expiresDate.getHours() + 24);
  
  // Generate transactionId dan paymentUrl berdasarkan metode pembayaran
  let transactionId: string | null = null;
  let paymentUrl: string | null = null;
  
  if (paymentMethod === PaymentMethod.credit_card) {
    transactionId = `ORDER-${faker.string.alphanumeric(8).toUpperCase()}`;
    paymentUrl = `https://sandbox.midtrans.com/snap/v2/vtweb/${faker.string.alphanumeric(32)}`;
  } else if (paymentMethod === PaymentMethod.bca_va || 
             paymentMethod === PaymentMethod.bni_va || 
             paymentMethod === PaymentMethod.bri_va || 
             paymentMethod === PaymentMethod.permata_va) {
    // Untuk Virtual Account atau transfer bank
    const bankCode = String(paymentMethod).split('_')[0].toUpperCase();
    transactionId = `${bankCode}-${faker.string.numeric(8)}`;
    paymentUrl = null;
  } else if (paymentMethod === PaymentMethod.gopay || 
             paymentMethod === PaymentMethod.shopeepay || 
             paymentMethod === PaymentMethod.dana || 
             paymentMethod === PaymentMethod.qris) {
    // E-wallet seperti GoPay, ShopeePay, DANA, dll
    const ewalletName = String(paymentMethod).toUpperCase();
    transactionId = `${ewalletName}-${faker.string.alphanumeric(10).toUpperCase()}`;
    paymentUrl = paymentMethod === PaymentMethod.qris ? 
      `https://sandbox.midtrans.com/qris/${faker.string.alphanumeric(16)}` : null;
  } else {
    // Metode lain (cash, dll)
    transactionId = `TRX-${faker.string.alphanumeric(10).toUpperCase()}`;
    paymentUrl = null;
  }
  
  // Modifikasi jumlah sedikit (±5%) untuk variasi
  const amountVariation = 1 + (faker.number.float({ min: -0.05, max: 0.05 }));
  const finalAmount = Math.round(amount * amountVariation);
  
  return {
    bookingId,
    userId,
    amount: overrides.amount || new Decimal(finalAmount),
    paymentMethod,
    status: overrides.status || status,
    createdAt,
    expiresDate: overrides.expiresDate || expiresDate,
    transactionId: overrides.transactionId !== undefined ? overrides.transactionId : transactionId,
    paymentUrl: overrides.paymentUrl !== undefined ? overrides.paymentUrl : paymentUrl,
  };
};

// Factory untuk menghasilkan payments untuk setiap booking
export const createPayments = async (
  prisma: PrismaClient,
  bookings: { id: number, userId: number, fieldId: number, bookingDate: Date, startTime: Date }[]
) => {
  console.log('Generating payments with faker...');
  console.log(`Preparing to create ${bookings.length} payments...`);
  
  // Hapus semua payments yang ada
  await prisma.payment.deleteMany({});
  
  const payments: any[] = [];
  
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
  
  // Buat struktur data untuk reporting volume transaksi per bulan
  const monthlyStats: Record<string, { count: number, total: number }> = {};
  
  // Buat batch payloads
  const paymentBatch: Omit<Payment, 'id'>[] = [];
  
  // Siapkan semua data payment
  for (const booking of bookings) {
    // Ambil harga field berdasarkan jam
    const fieldPrice = fieldPrices[booking.fieldId];
    
    if (!fieldPrice) continue; // Skip jika field tidak ditemukan
    
    // Tentukan harga berdasarkan waktu (siang/malam)
    const hour = booking.startTime.getHours();
    const isNight = hour >= 18 || hour < 6; // Malam hari: 18:00 - 06:00
    
    let price = isNight ? fieldPrice.night : fieldPrice.day;
    
    // Tambahkan variasi harga berdasarkan hari dalam seminggu
    // Akhir pekan (Jumat, Sabtu, Minggu) 10-15% lebih mahal
    const dayOfWeek = booking.bookingDate.getDay();
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      price = price * (1 + faker.number.float({ min: 0.1, max: 0.15 }));
    }
    
    // Harga lebih tinggi di peak hours (17:00 - 21:00) tambahan 5-10%
    if (hour >= 17 && hour <= 20) {
      price = price * (1 + faker.number.float({ min: 0.05, max: 0.1 }));
    }
    
    // Generate payment data
    const paymentData = generatePayment(booking.id, booking.userId, price, booking.bookingDate);
    paymentBatch.push(paymentData);
  }
  
  // Proses pembayaran dalam batch untuk efisiensi
  const chunkSize = 100;
  console.log(`Processing ${paymentBatch.length} payments in batches of ${chunkSize}...`);
  
  for (let i = 0; i < paymentBatch.length; i += chunkSize) {
    const chunk = paymentBatch.slice(i, i + chunkSize);
    console.log(`Processing payment batch ${Math.floor(i/chunkSize) + 1}/${Math.ceil(paymentBatch.length/chunkSize)}...`);
    
    // Create payments one by one in the current chunk
    for (const paymentData of chunk) {
      const payment = await prisma.payment.create({
        data: paymentData
      });
      
      payments.push(payment);
      
      // Catat statistik per bulan untuk reporting
      const booking = bookings.find(b => b.id === payment.bookingId);
      if (booking) {
        const monthYear = `${booking.bookingDate.getMonth()+1}-${booking.bookingDate.getFullYear()}`;
        if (!monthlyStats[monthYear]) {
          monthlyStats[monthYear] = { count: 0, total: 0 };
        }
        monthlyStats[monthYear].count++;
        monthlyStats[monthYear].total += Number(payment.amount);
      }
    }
  }
  
  console.log(`Successfully generated ${payments.length} payments.`);
  
  // Hitung statistik berdasarkan tahun
  const yearlyStats: Record<string, { count: number, total: number }> = {};
  Object.entries(monthlyStats).forEach(([monthYear, stats]) => {
    const year = monthYear.split('-')[1];
    if (!yearlyStats[year]) {
      yearlyStats[year] = { count: 0, total: 0 };
    }
    yearlyStats[year].count += stats.count;
    yearlyStats[year].total += stats.total;
  });
  
  // Tampilkan ringkasan statistik transaksi per tahun
  console.log('\nYearly Payment Statistics:');
  Object.entries(yearlyStats).forEach(([year, stats]) => {
    console.log(`Year ${year}: ${stats.count} transactions, total Rp${stats.total.toLocaleString('id-ID')}`);
  });
  
  // Tampilkan ringkasan statistik transaksi per bulan
  console.log('\nMonthly Payment Statistics:');
  Object.entries(monthlyStats)
    .sort((a, b) => {
      // Sort by year and month
      const [aMonth, aYear] = a[0].split('-').map(Number);
      const [bMonth, bYear] = b[0].split('-').map(Number);
      
      if (aYear !== bYear) return aYear - bYear;
      return aMonth - bMonth;
    })
    .forEach(([month, stats]) => {
      console.log(`Bulan ${month}: ${stats.count} transaksi, total Rp${stats.total.toLocaleString('id-ID')}`);
    });
  
  // Verifikasi bahwa setiap booking memiliki payment
  const bookingsWithPayment = new Set(payments.map(p => p.bookingId));
  const bookingsWithoutPayment = bookings.filter(b => !bookingsWithPayment.has(b.id));
  
  if (bookingsWithoutPayment.length > 0) {
    console.log(`Warning: ${bookingsWithoutPayment.length} bookings do not have associated payments!`);
  } else {
    console.log(`All ${bookings.length} bookings have associated payments.`);
  }
  
  return payments;
}; 