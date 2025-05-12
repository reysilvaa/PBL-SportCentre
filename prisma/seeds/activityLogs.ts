import { PrismaClient } from '@prisma/client';

export default async function seedActivityLogs(prisma: PrismaClient) {
  // Ambil semua pengguna
  const users = await prisma.user.findMany();
  
  if (!users.length) {
    throw new Error('Tidak ada pengguna ditemukan');
  }

  // Array untuk menyimpan data aktivitas
  const activityLogData = [];
  
  // Jenis-jenis aktivitas
  const actionTypes = [
    'BOOKING_CREATED',
    'PAYMENT_COMPLETED',
    'REVIEW_SUBMITTED',
    'LOGIN',
    'LOGOUT',
    'PROFILE_UPDATED',
    'CANCEL_BOOKING',
    'RESCHEDULE_BOOKING',
    'NOTIFICATION_READ',
    'SEARCH_FIELD'
  ];
  
  // IP Address random
  const ipAddresses = [
    '192.168.1.1',
    '10.0.0.5',
    '172.16.0.10',
    '192.168.0.100',
    '127.0.0.1',
    '8.8.8.8',
    '1.1.1.1',
    '36.85.212.45',
    '114.122.68.12',
    '182.253.194.65'
  ];
  
  // Buat aktivitas untuk rentang waktu 6 tahun terakhir
  for (let yearOffset = 0; yearOffset < 6; yearOffset++) {
    const year = 2025 - yearOffset;
    
    // Jumlah aktivitas per tahun
    const activitiesPerYear = 100 + Math.floor(Math.random() * 100);
    
    for (let i = 0; i < activitiesPerYear; i++) {
      // Pilih pengguna acak
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      // Pilih jenis aktivitas acak
      const randomAction = actionTypes[Math.floor(Math.random() * actionTypes.length)];
      
      // Pilih IP acak
      const randomIp = ipAddresses[Math.floor(Math.random() * ipAddresses.length)];
      
      // Tentukan tanggal acak dalam tahun tersebut
      const month = Math.floor(Math.random() * 12);
      const day = Math.floor(Math.random() * 28) + 1;
      const hour = Math.floor(Math.random() * 24);
      const minute = Math.floor(Math.random() * 60);
      const createdAt = new Date(year, month, day, hour, minute, 0);
      
      // Buat detail yang berbeda sesuai jenis aktivitas
      let details = '';
      
      switch (randomAction) {
        case 'BOOKING_CREATED':
          details = `Membuat booking untuk Lapangan #${Math.floor(Math.random() * 10) + 1}`;
          break;
        case 'PAYMENT_COMPLETED':
          details = `Menyelesaikan pembayaran untuk booking #${Math.floor(Math.random() * 1000) + 1}`;
          break;
        case 'REVIEW_SUBMITTED':
          details = `Mengirim ulasan untuk Lapangan #${Math.floor(Math.random() * 10) + 1}`;
          break;
        case 'LOGIN':
          details = `Login dari perangkat ${Math.random() < 0.7 ? 'Mobile' : 'Desktop'}`;
          break;
        case 'LOGOUT':
          details = `Logout dari perangkat ${Math.random() < 0.7 ? 'Mobile' : 'Desktop'}`;
          break;
        case 'PROFILE_UPDATED':
          details = `Memperbarui informasi profil`;
          break;
        case 'CANCEL_BOOKING':
          details = `Membatalkan booking #${Math.floor(Math.random() * 1000) + 1}`;
          break;
        case 'RESCHEDULE_BOOKING':
          details = `Menjadwalkan ulang booking #${Math.floor(Math.random() * 1000) + 1}`;
          break;
        case 'NOTIFICATION_READ':
          details = `Membaca notifikasi #${Math.floor(Math.random() * 100) + 1}`;
          break;
        case 'SEARCH_FIELD':
          details = `Mencari lapangan di area ${['Jakarta', 'Bandung', 'Surabaya', 'Malang', 'Yogyakarta'][Math.floor(Math.random() * 5)]}`;
          break;
      }
      
      activityLogData.push({
        userId: randomUser.id,
        action: randomAction,
        details,
        ipAddress: randomIp,
        createdAt
      });
    }
  }
  
  // Tambahkan aktivitas khusus untuk bulan Mei 2025
  const meiActivities = 200; // Jumlah aktivitas untuk Mei 2025
  
  for (let i = 0; i < meiActivities; i++) {
    // Pilih pengguna acak
    const randomUser = users[Math.floor(Math.random() * users.length)];
    
    // Pilih jenis aktivitas acak
    const randomAction = actionTypes[Math.floor(Math.random() * actionTypes.length)];
    
    // Pilih IP acak
    const randomIp = ipAddresses[Math.floor(Math.random() * ipAddresses.length)];
    
    // Tanggal acak dalam Mei 2025
    const day = Math.floor(Math.random() * 31) + 1;
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const createdAt = new Date(2025, 4, day, hour, minute, 0); // Mei = bulan ke-4 (zero-based)
    
    // Buat detail aktivitas
    let details = '';
    
    switch (randomAction) {
      case 'BOOKING_CREATED':
        details = `Membuat booking untuk Lapangan #${Math.floor(Math.random() * 10) + 1}`;
        break;
      case 'PAYMENT_COMPLETED':
        details = `Menyelesaikan pembayaran untuk booking #${Math.floor(Math.random() * 1000) + 1}`;
        break;
      case 'REVIEW_SUBMITTED':
        details = `Mengirim ulasan untuk Lapangan #${Math.floor(Math.random() * 10) + 1}`;
        break;
      case 'LOGIN':
        details = `Login dari perangkat ${Math.random() < 0.7 ? 'Mobile' : 'Desktop'}`;
        break;
      case 'LOGOUT':
        details = `Logout dari perangkat ${Math.random() < 0.7 ? 'Mobile' : 'Desktop'}`;
        break;
      case 'PROFILE_UPDATED':
        details = `Memperbarui informasi profil`;
        break;
      case 'CANCEL_BOOKING':
        details = `Membatalkan booking #${Math.floor(Math.random() * 1000) + 1}`;
        break;
      case 'RESCHEDULE_BOOKING':
        details = `Menjadwalkan ulang booking #${Math.floor(Math.random() * 1000) + 1}`;
        break;
      case 'NOTIFICATION_READ':
        details = `Membaca notifikasi #${Math.floor(Math.random() * 100) + 1}`;
        break;
      case 'SEARCH_FIELD':
        details = `Mencari lapangan di area ${['Jakarta', 'Bandung', 'Surabaya', 'Malang', 'Yogyakarta'][Math.floor(Math.random() * 5)]}`;
        break;
    }
    
    activityLogData.push({
      userId: randomUser.id,
      action: randomAction,
      details,
      ipAddress: randomIp,
      createdAt
    });
  }

  // Buat activity logs dalam database
  const activityLogs = await prisma.activityLog.createMany({
    data: activityLogData,
    skipDuplicates: true,
  });

  return activityLogs.count;
}
