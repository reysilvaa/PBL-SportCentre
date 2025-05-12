import { PrismaClient } from '@prisma/client';

export default async function seedBookings(prisma: PrismaClient) {
  // Get all users with role 'user'
  const users = await prisma.user.findMany({
    where: { role: 'user' },
  });

  // Get available fields
  const fields = await prisma.field.findMany();

  if (!users.length || !fields.length) {
    throw new Error('Required users and fields not found');
  }

  // Buat array untuk data booking
  const bookingData = [];

  // Data untuk bulan Mei 2025 (untuk menguji periode bulanan)
  for (let day = 1; day <= 31; day++) {
    // Skip jika melebihi jumlah hari di bulan Mei
    if (day > 31) continue;

    // Buat 2-5 booking per hari dengan jam yang bervariasi
    const bookingsPerDay = Math.floor(Math.random() * 4) + 2;
    
    for (let b = 0; b < bookingsPerDay; b++) {
      // Acak user dan field
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomField = fields[Math.floor(Math.random() * fields.length)];
      
      // Tentukan waktu mulai - bervariasi antara jam 6 pagi - 8 malam
      const startHour = 6 + Math.floor(Math.random() * 14);
      
      // Tanggal dan waktu booking
      const bookingDate = new Date(2025, 4, day); // Mei = bulan ke-4 (zero-based)
      const startTime = new Date(2025, 4, day, startHour, 0, 0);
      const endTime = new Date(2025, 4, day, startHour + 2, 0, 0);

      bookingData.push({
        userId: randomUser.id,
        fieldId: randomField.id,
        bookingDate,
        startTime,
        endTime,
      });
    }
  }

  // Data untuk 12 bulan terakhir (untuk menguji tren bulanan)
  for (let month = 0; month < 12; month++) {
    // Hitung tanggal untuk bulan ini (dari Mei 2024 - April 2025)
    const year = month < 4 ? 2025 : 2024;
    const monthIndex = month < 4 ? month : month + 8;  // 0-3 untuk Jan-Apr 2025, 8-11 untuk Mei-Des 2024
    
    // Buat 15-30 booking per bulan
    const bookingsPerMonth = Math.floor(Math.random() * 16) + 15;
    
    for (let b = 0; b < bookingsPerMonth; b++) {
      // Acak user dan field
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomField = fields[Math.floor(Math.random() * fields.length)];
      
      // Acak tanggal dalam bulan (1-28 untuk menghindari masalah bulan pendek)
      const day = Math.floor(Math.random() * 28) + 1;
      
      // Acak jam mulai antara 6 pagi - 8 malam
      const startHour = 6 + Math.floor(Math.random() * 14);
      
      // Tanggal dan waktu booking
      const bookingDate = new Date(year, monthIndex, day);
      const startTime = new Date(year, monthIndex, day, startHour, 0, 0);
      const endTime = new Date(year, monthIndex, day, startHour + 2, 0, 0);

      bookingData.push({
        userId: randomUser.id,
        fieldId: randomField.id,
        bookingDate,
        startTime,
        endTime,
      });
    }
  }

  // Data untuk 6 tahun terakhir (untuk menguji tren tahunan)
  for (let yearOffset = 0; yearOffset < 6; yearOffset++) {
    const year = 2025 - yearOffset;
    
    // Buat 50-100 booking per tahun (selain tahun 2025 yang sudah diisi di atas)
    const bookingsPerYear = yearOffset > 0 ? Math.floor(Math.random() * 51) + 50 : 0;
    
    for (let b = 0; b < bookingsPerYear; b++) {
      // Acak user dan field
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomField = fields[Math.floor(Math.random() * fields.length)];
      
      // Acak bulan dan tanggal
      const month = Math.floor(Math.random() * 12);
      const day = Math.floor(Math.random() * 28) + 1;
      
      // Acak jam mulai antara 6 pagi - 8 malam
      const startHour = 6 + Math.floor(Math.random() * 14);
      
      // Tanggal dan waktu booking
      const bookingDate = new Date(year, month, day);
      const startTime = new Date(year, month, day, startHour, 0, 0);
      const endTime = new Date(year, month, day, startHour + 2, 0, 0);

      // Skip untuk 2025 karena sudah diisi di atas
      if (yearOffset > 0) {
        bookingData.push({
          userId: randomUser.id,
          fieldId: randomField.id,
          bookingDate,
          startTime,
          endTime,
        });
      }
    }
  }

  // Buat booking dalam database
  const bookings = await prisma.booking.createMany({
    data: bookingData,
    skipDuplicates: true,
  });

  return bookings.count;
}
