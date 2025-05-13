import { PrismaClient, Booking } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';

// Fungsi untuk menghasilkan booking tunggal
export const generateBooking = (
  userId: number,
  fieldId: number,
  overrides: Partial<Booking> = {}
): Omit<Booking, 'id'> => {
  // Generate tanggal booking yang lebih bervariasi (dari 2023 hingga 2025)
  // Ini akan menghasilkan data historis yang lebih luas untuk chart
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Tentukan rentang tahun (2023-2025)
  const randomYear = faker.number.int({ min: 2023, max: currentYear });
  
  // Untuk tahun 2023 dan 2024, kita akan menggunakan rentang bulan sepanjang tahun
  // Untuk tahun 2025, kita batasi sampai bulan saat ini + 2
  let minMonth = 0; // Januari
  let maxMonth = 11; // Desember
  
  if (randomYear === currentYear) {
    // Untuk tahun saat ini, batasi sampai bulan saat ini + 2
    maxMonth = Math.min(now.getMonth() + 2, 11); // Maksimal Desember
  }
  
  // Tentukan bulan secara acak dalam rentang yang berlaku
  const randomMonth = faker.number.int({ min: minMonth, max: maxMonth });
  
  // Tentukan tanggal secara acak (1-28 untuk menjaga konsistensi di semua bulan)
  const randomDay = faker.number.int({ min: 1, max: 28 });
  
  // Buat tanggal booking
  const targetDate = new Date(randomYear, randomMonth, randomDay);
  
  // Buat peluang booking yang lebih tinggi di akhir pekan (Jumat, Sabtu, Minggu)
  let bookingDate = new Date(targetDate);
  const dayOfWeek = bookingDate.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  
  // Probabilitas hari dalam seminggu (akhir pekan lebih tinggi)
  if (faker.number.int({ min: 1, max: 100 }) <= 70) {
    // 70% kemungkinan booking di akhir pekan
    const weekend = [5, 6, 0]; // Jumat, Sabtu, Minggu
    const randomWeekendDay = faker.helpers.arrayElement(weekend);
    const dayDifference = (randomWeekendDay - dayOfWeek + 7) % 7;
    bookingDate.setDate(bookingDate.getDate() + dayDifference);
  }
  
  bookingDate.setHours(0, 0, 0, 0); // Reset jam ke 00:00:00
  
  // Jam operasional: 06:00 - 23:00
  // Pola jam booking lebih realistis dengan peak hours
  let startHour;
  const timePattern = faker.number.int({ min: 1, max: 100 });
  
  if (timePattern <= 20) {
    // 20% - pagi (06:00 - 10:00)
    startHour = faker.number.int({ min: 6, max: 9 });
  } else if (timePattern <= 35) {
    // 15% - siang (10:00 - 14:00)
    startHour = faker.number.int({ min: 10, max: 13 });
  } else if (timePattern <= 50) {
    // 15% - sore awal (14:00 - 17:00)
    startHour = faker.number.int({ min: 14, max: 16 });
  } else if (timePattern <= 90) {
    // 40% - sore-malam peak hours (17:00 - 21:00)
    startHour = faker.number.int({ min: 17, max: 20 });
  } else {
    // 10% - malam (21:00 - 23:00)
    startHour = faker.number.int({ min: 21, max: 22 });
  }
  
  // Durasi sewa bervariasi (1, 1.5, atau 2 jam)
  const durationOptions = [1, 1.5, 2];
  const durationWeights = [3, 2, 5]; // 30% 1 jam, 20% 1.5 jam, 50% 2 jam
  const duration = faker.helpers.weightedArrayElement(
    durationOptions.map((val, idx) => ({ value: val, weight: durationWeights[idx] }))
  );
  
  const startTime = new Date(bookingDate);
  startTime.setHours(startHour, duration === 1.5 ? 30 : 0, 0, 0);
  
  const endTime = new Date(startTime);
  const endHour = Math.floor(duration);
  const endMinute = (duration % 1) * 60;
  endTime.setHours(startTime.getHours() + endHour, startTime.getMinutes() + endMinute, 0, 0);
  
  // Untuk data historis, pastikan createdAt sebelum bookingDate
  let createdAt;
  
  // Distribusi createdAt berdasarkan waktu booking
  if (bookingDate < now) {
    // Untuk booking masa lalu, createdAt adalah 1-7 hari sebelum bookingDate
    createdAt = new Date(bookingDate);
    createdAt.setDate(createdAt.getDate() - faker.number.int({ min: 1, max: 7 }));
  } else {
    // Untuk booking masa depan, createdAt adalah 1-14 hari sebelum hari ini
    createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - faker.number.int({ min: 1, max: 14 }));
  }
  
  return {
    userId,
    fieldId,
    bookingDate: overrides.bookingDate || bookingDate,
    startTime: overrides.startTime || startTime,
    endTime: overrides.endTime || endTime,
    createdAt: overrides.createdAt || createdAt,
  };
};

// Factory untuk menghasilkan banyak bookings dengan distribusi yang merata per tahun
export const createBookings = async (
  prisma: PrismaClient,
  userIds: number[],
  fields: { id: number }[]
) => {
  console.log('Generating bookings with faker...');
  
  // Hapus semua bookings dan payment yang ada
  await prisma.payment.deleteMany({});
  await prisma.booking.deleteMany({});
  
  const bookings: any[] = [];
  
  // Jumlah booking yang lebih besar - 1000 booking
  const bookingCount = 1000;
  
  // Pastikan distribusi yang relatif merata dari 2023-2025
  const years = [2023, 2024, 2025];
  const yearCounts = {
    2023: Math.floor(bookingCount * 0.3), // 30% dari total (300 data)
    2024: Math.floor(bookingCount * 0.4), // 40% dari total (400 data) 
    2025: Math.floor(bookingCount * 0.3), // 30% dari total (300 data)
  };
  
  // Distribusi user yang lebih realistis (beberapa user lebih aktif)
  // 20% user melakukan 60% booking
  const activeUsers = faker.helpers.arrayElements(userIds, Math.ceil(userIds.length * 0.2));
  const regularUsers = userIds.filter(id => !activeUsers.includes(id));
  
  // Beberapa lapangan lebih populer dari yang lain
  const popularFields = faker.helpers.arrayElements(fields, Math.ceil(fields.length * 0.3));
  const regularFields = fields.filter(field => !popularFields.some(pf => pf.id === field.id));
  
  console.log(`Generating ${bookingCount} bookings with distribution: 2023 (${yearCounts[2023]}), 2024 (${yearCounts[2024]}), 2025 (${yearCounts[2025]})`);
  
  // Buat array untuk menampung batch creates
  const bookingBatch = [];
  
  // Generate bookings untuk setiap tahun berdasarkan distribusi yang ditentukan
  for (const year of years) {
    const yearBookingCount = yearCounts[year as keyof typeof yearCounts];
    
    for (let i = 0; i < yearBookingCount; i++) {
      // 60% booking dari active users
      const isActiveUserBooking = faker.number.int({ min: 1, max: 100 }) <= 60;
      const userId = isActiveUserBooking 
        ? faker.helpers.arrayElement(activeUsers) 
        : faker.helpers.arrayElement(regularUsers);
      
      // 70% booking di popular fields
      const isPopularFieldBooking = faker.number.int({ min: 1, max: 100 }) <= 70;
      const field = isPopularFieldBooking
        ? faker.helpers.arrayElement(popularFields)
        : faker.helpers.arrayElement(regularFields);
      
      // Buat booking dengan override tahun
      const bookingData = generateBooking(userId, field.id);
      
      // Atur tahun booking secara paksa untuk memastikan distribusi
      bookingData.bookingDate.setFullYear(year);
      bookingData.startTime.setFullYear(year);
      bookingData.endTime.setFullYear(year);
      
      // Untuk tahun 2023 dan 2024, createdAt juga harus disesuaikan
      if (year < new Date().getFullYear()) {
        const createdAt = new Date(bookingData.bookingDate);
        createdAt.setDate(createdAt.getDate() - faker.number.int({ min: 1, max: 7 }));
        bookingData.createdAt = createdAt;
      }
      
      // Tambahkan ke batch
      bookingBatch.push(bookingData);
    }
  }
  
  // Gunakan createMany untuk lebih efisien dengan 1000 data
  // Namun karena createMany tidak mengembalikan data yang dibuat dan tidak mendukung relasi,
  // maka kita gunakan pendekatan chunk untuk membuat data dalam batch
  const chunkSize = 100;
  for (let i = 0; i < bookingBatch.length; i += chunkSize) {
    const chunk = bookingBatch.slice(i, i + chunkSize);
    console.log(`Processing booking batch ${i/chunkSize + 1}/${Math.ceil(bookingBatch.length/chunkSize)}...`);
    
    // Buat booking menggunakan loop satu per satu dalam chunk
    for (const data of chunk) {
      const booking = await prisma.booking.create({
        data: data
      });
      bookings.push(booking);
    }
  }
  
  // Hitungan distribusi tahun aktual untuk laporan
  const yearDistribution = bookings.reduce((acc: Record<string, number>, booking: any) => {
    const year = booking.bookingDate.getFullYear();
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});
  
  // Hitung distribusi bulan untuk setiap tahun
  const monthDistribution: Record<string, Record<string, number>> = {};
  years.forEach(year => {
    monthDistribution[year] = {};
    for (let month = 1; month <= 12; month++) {
      monthDistribution[year][month] = 0;
    }
  });
  
  bookings.forEach((booking: any) => {
    const year = booking.bookingDate.getFullYear();
    const month = booking.bookingDate.getMonth() + 1; // Januari = 1
    monthDistribution[year][month]++;
  });
  
  console.log(`Generated ${bookings.length} bookings with year distribution:`, yearDistribution);
  console.log('Monthly distribution:');
  Object.entries(monthDistribution).forEach(([year, months]) => {
    console.log(`Year ${year}:`, months);
  });
  
  return bookings;
}; 