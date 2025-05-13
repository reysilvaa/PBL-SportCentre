import { PrismaClient, Booking } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';

// Fungsi untuk menghasilkan booking tunggal
export const generateBooking = (
  userId: number,
  fieldId: number,
  overrides: Partial<Booking> = {}
): Omit<Booking, 'id'> => {
  // Generate tanggal booking (dari sekarang sampai 3 bulan ke depan)
  const futureDate = faker.date.future({ years: 0.25 });
  
  // Tetapkan tanggal booking dan waktu mulai/selesai
  const bookingDate = new Date(futureDate);
  bookingDate.setHours(0, 0, 0, 0); // Reset jam ke 00:00:00
  
  // Jam operasional: 08:00 - 22:00
  // Durasi sewa biasanya 1-2 jam
  const startHour = faker.number.int({ min: 8, max: 20 });
  const duration = faker.helpers.arrayElement([1, 2]);
  
  const startTime = new Date(futureDate);
  startTime.setHours(startHour, 0, 0, 0);
  
  const endTime = new Date(startTime);
  endTime.setHours(startTime.getHours() + duration, 0, 0, 0);
  
  return {
    userId,
    fieldId,
    bookingDate: overrides.bookingDate || bookingDate,
    startTime: overrides.startTime || startTime,
    endTime: overrides.endTime || endTime,
    createdAt: overrides.createdAt || faker.date.past(),
  };
};

// Factory untuk menghasilkan banyak bookings
export const createBookings = async (
  prisma: PrismaClient,
  userIds: number[],
  fields: { id: number }[]
) => {
  console.log('Generating bookings with faker...');
  
  // Hapus semua bookings dan payment yang ada
  await prisma.payment.deleteMany({});
  await prisma.booking.deleteMany({});
  
  const bookings = [];
  
  // Jumlah booking yang akan dibuat (antara 50 dan 100)
  const bookingCount = faker.number.int({ min: 50, max: 100 });
  
  for (let i = 0; i < bookingCount; i++) {
    // Pilih user secara acak
    const userId = faker.helpers.arrayElement(userIds);
    
    // Pilih field secara acak
    const field = faker.helpers.arrayElement(fields);
    
    // Buat booking
    const booking = await prisma.booking.create({
      data: generateBooking(userId, field.id)
    });
    
    bookings.push(booking);
  }
  
  console.log(`Generated ${bookings.length} bookings.`);
  
  return bookings;
}; 