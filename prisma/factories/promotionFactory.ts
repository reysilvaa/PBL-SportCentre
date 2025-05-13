import { PrismaClient, Promotion, PromotionStatus } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';
import { Decimal } from '@prisma/client/runtime/library';

// Fungsi untuk menghasilkan promotion tunggal
export const generatePromotion = (overrides: Partial<Promotion> = {}): Omit<Promotion, 'id'> => {
  // Generate kode promo
  const code = overrides.code || `PROMO${faker.string.alphanumeric(6).toUpperCase()}`;
  
  // Generate deskripsi promo
  const descriptions = [
    'Diskon untuk pengguna baru',
    'Diskon akhir pekan',
    'Promo bulan Ramadhan',
    'Diskon hari kemerdekaan',
    'Promo akhir tahun',
    'Diskon ulang tahun',
    'Promo khusus member',
    'Diskon pembukaan cabang baru',
  ];
  const description = overrides.description || faker.helpers.arrayElement(descriptions);
  
  // Diskon antara 5% - 30%
  const discountPercent = overrides.discountPercent || new Decimal(faker.number.int({ min: 5, max: 30 }));
  
  // Maksimal diskon antara 50.000 - 200.000
  const maxDiscount = overrides.maxDiscount || new Decimal(faker.number.int({ min: 50000, max: 200000 }));
  
  // Tanggal berlaku diskon (mulai dari 1-2 bulan yang lalu)
  const validFrom = overrides.validFrom || faker.date.past({ years: 0.2 });
  
  // Tanggal kadaluarsa diskon (beberapa bulan ke depan dari validFrom)
  const validUntil = overrides.validUntil || faker.date.future({ years: 0.5, refDate: validFrom });
  
  // Status diskon - 80% active, 10% expired, 10% disabled
  let status;
  const statusRandom = faker.number.float({ min: 0, max: 1 });
  if (statusRandom < 0.8) {
    status = PromotionStatus.active;
  } else if (statusRandom < 0.9) {
    status = PromotionStatus.expired;
  } else {
    status = PromotionStatus.disabled;
  }
  
  return {
    code,
    description,
    discountPercent,
    maxDiscount,
    validFrom,
    validUntil,
    status: overrides.status || status,
    createdAt: overrides.createdAt || faker.date.past(),
  };
};

// Factory untuk menghasilkan banyak promotions
export const createPromotions = async (prisma: PrismaClient) => {
  console.log('Generating promotions with faker...');
  
  // Hapus semua promo usages dan promo yang ada
  await prisma.promotionUsage.deleteMany({});
  await prisma.promotion.deleteMany({});
  
  // Jumlah promo yang akan dibuat (antara 5 dan 10)
  const promoCount = faker.number.int({ min: 5, max: 10 });
  
  const promotions = [];
  
  for (let i = 0; i < promoCount; i++) {
    const promotion = await prisma.promotion.create({
      data: generatePromotion()
    });
    
    promotions.push(promotion);
  }
  
  console.log(`Generated ${promotions.length} promotions.`);
  
  return promotions;
};

// Factory untuk menghasilkan promo usages
export const createPromotionUsages = async (
  prisma: PrismaClient,
  bookings: { id: number, userId: number }[],
  promotions: { id: number }[]
) => {
  console.log('Generating promotion usages with faker...');
  
  // Hapus semua promotion usages yang ada
  await prisma.promotionUsage.deleteMany({});
  
  const promoUsages = [];
  
  // Hanya 30% booking yang menggunakan promo
  const bookingsWithPromo = faker.helpers.arrayElements(
    bookings,
    Math.floor(bookings.length * 0.3)
  );
  
  for (const booking of bookingsWithPromo) {
    // Pilih promo secara acak
    const promotion = faker.helpers.arrayElement(promotions);
    
    const promoUsage = await prisma.promotionUsage.create({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        promoId: promotion.id,
        createdAt: faker.date.past(),
      }
    });
    
    promoUsages.push(promoUsage);
  }
  
  console.log(`Generated ${promoUsages.length} promotion usages.`);
  
  return promoUsages;
}; 