import { PrismaClient, Notification } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';

// Fungsi untuk menghasilkan notifikasi tunggal
export const generateNotification = (
  userId: number,
  overrides: Partial<Notification> = {}
): Omit<Notification, 'id'> => {
  // Tipe notifikasi
  const notificationTypes = [
    'booking_confirmation',
    'payment_success',
    'payment_reminder',
    'booking_reminder',
    'promo_notification',
    'booking_cancellation',
    'review_request',
    'system_notification',
  ];
  
  const type = overrides.type || faker.helpers.arrayElement(notificationTypes);
  
  // Judul dan pesan berdasarkan tipe
  let title = '';
  let message = '';
  let linkId = '';
  
  switch (type) {
    case 'booking_confirmation':
      title = 'Pesanan Berhasil Dibuat';
      message = `Pesanan lapangan Anda telah berhasil dibuat. Silakan lakukan pembayaran dalam waktu 24 jam.`;
      linkId = `booking_${faker.number.int({ min: 1, max: 1000 })}`;
      break;
    case 'payment_success':
      title = 'Pembayaran Berhasil';
      message = `Pembayaran pesanan Anda telah berhasil. Terima kasih telah melakukan transaksi.`;
      linkId = `payment_${faker.number.int({ min: 1, max: 1000 })}`;
      break;
    case 'payment_reminder':
      title = 'Pengingat Pembayaran';
      message = `Segera lakukan pembayaran untuk pesanan Anda sebelum ${faker.date.future().toLocaleDateString()}.`;
      linkId = `payment_${faker.number.int({ min: 1, max: 1000 })}`;
      break;
    case 'booking_reminder':
      title = 'Pengingat Jadwal Bermain';
      message = `Jangan lupa jadwal Anda untuk bermain besok pukul ${faker.date.future().toLocaleTimeString()}.`;
      linkId = `booking_${faker.number.int({ min: 1, max: 1000 })}`;
      break;
    case 'promo_notification':
      title = 'Promo Spesial untuk Anda';
      message = `Gunakan kode ${faker.string.alphanumeric(8).toUpperCase()} untuk mendapatkan diskon ${faker.number.int({ min: 5, max: 25 })}%.`;
      linkId = `promo_${faker.number.int({ min: 1, max: 100 })}`;
      break;
    case 'booking_cancellation':
      title = 'Pesanan Dibatalkan';
      message = `Pesanan Anda telah dibatalkan. Silakan hubungi kami untuk informasi lebih lanjut.`;
      linkId = `booking_${faker.number.int({ min: 1, max: 1000 })}`;
      break;
    case 'review_request':
      title = 'Beri Ulasan untuk Pengalaman Anda';
      message = `Bagaimana pengalaman Anda bermain di lapangan kami? Berikan ulasan Anda sekarang.`;
      linkId = `field_${faker.number.int({ min: 1, max: 100 })}`;
      break;
    case 'system_notification':
      title = 'Informasi Sistem';
      message = `Sistem kami sedang dalam pemeliharaan pada tanggal ${faker.date.future().toLocaleDateString()} mulai pukul ${faker.date.future().toLocaleTimeString()}.`;
      break;
  }
  
  // Isikan nilai dari override jika ada
  title = overrides.title || title;
  message = overrides.message || message;
  linkId = overrides.linkId || linkId;
  
  return {
    userId,
    title,
    message,
    isRead: overrides.isRead !== undefined ? overrides.isRead : faker.number.int({ min: 0, max: 1 }) === 0,
    type,
    linkId,
    createdAt: overrides.createdAt || faker.date.past(),
  };
};

// Factory untuk menghasilkan notifications
export const createNotifications = async (
  prisma: PrismaClient,
  userIds: number[]
) => {
  console.log('Generating notifications with faker...');
  
  // Hapus semua notifications yang ada
  await prisma.notification.deleteMany({});
  
  const notifications = [];
  
  // Buat beberapa notifikasi untuk setiap user
  for (const userId of userIds) {
    // Jumlah notifikasi per user (antara 2 dan 10)
    const notificationCount = faker.number.int({ min: 2, max: 10 });
    
    for (let i = 0; i < notificationCount; i++) {
      const notification = await prisma.notification.create({
        data: generateNotification(userId)
      });
      
      notifications.push(notification);
    }
  }
  
  console.log(`Generated ${notifications.length} notifications.`);
  
  return notifications;
}; 