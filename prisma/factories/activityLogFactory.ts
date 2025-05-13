import { PrismaClient, ActivityLog } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';

// Fungsi untuk menghasilkan activity log tunggal
export const generateActivityLog = (
  userId: number,
  overrides: Partial<ActivityLog> = {}
): Omit<ActivityLog, 'id'> => {
  // Jenis aktivitas
  const actions = [
    'login',
    'logout',
    'create_booking',
    'update_profile',
    'cancel_booking',
    'payment_success',
    'payment_failed',
    'create_review',
    'update_branch',
    'view_bookings',
    'view_fields',
    'view_field_details',
    'view_branch_details',
    'reset_password',
    'add_admin',
    'remove_admin',
    'update_field',
  ];
  
  const action = overrides.action || faker.helpers.arrayElement(actions);
  
  // Buat detail berdasarkan tipe aktivitas
  let details = '';
  let ipAddress = faker.internet.ipv4();
  
  switch (action) {
    case 'login':
      details = `User logged in from ${faker.location.city()}.`;
      break;
    case 'logout':
      details = `User logged out.`;
      break;
    case 'create_booking':
      details = `Created booking for field #${faker.number.int({ min: 1, max: 100 })} on ${faker.date.future().toLocaleDateString()}.`;
      break;
    case 'update_profile':
      details = `Updated profile information.`;
      break;
    case 'cancel_booking':
      details = `Cancelled booking #${faker.number.int({ min: 1, max: 1000 })}.`;
      break;
    case 'payment_success': {
      // Lebih bervariasi untuk data transaksi pembayaran
      const bookingId = faker.number.int({ min: 1, max: 1000 });
      const amount = faker.number.int({ min: 75000, max: 500000 });
      const paymentMethods = ['transfer', 'midtrans', 'ewallet', 'credit_card', 'cash'];
      const paymentMethod = faker.helpers.arrayElement(paymentMethods);
      
      // Format jumlah dengan pemisah ribuan
      const formattedAmount = new Intl.NumberFormat('id-ID').format(amount);
      
      details = `Successfully paid booking #${bookingId} with amount Rp${formattedAmount} via ${paymentMethod}.`;
      break;
    }
    case 'payment_failed': {
      const bookingId = faker.number.int({ min: 1, max: 1000 });
      const paymentMethods = ['transfer', 'midtrans', 'ewallet', 'credit_card'];
      const paymentMethod = faker.helpers.arrayElement(paymentMethods);
      const reasons = [
        'insufficient funds', 
        'payment timeout', 
        'transaction declined', 
        'network error',
        'invalid payment details'
      ];
      const reason = faker.helpers.arrayElement(reasons);
      
      details = `Failed payment for booking #${bookingId} via ${paymentMethod}: ${reason}.`;
      break;
    }
    case 'create_review':
      details = `Created review for field #${faker.number.int({ min: 1, max: 100 })} with rating ${faker.number.int({ min: 1, max: 5 })}.`;
      break;
    case 'update_branch':
      details = `Updated information for branch #${faker.number.int({ min: 1, max: 50 })}.`;
      break;
    case 'view_bookings':
      details = `Viewed booking history.`;
      break;
    case 'view_fields':
      details = `Searched for fields in ${faker.location.city()}.`;
      break;
    case 'view_field_details':
      details = `Viewed details of field #${faker.number.int({ min: 1, max: 100 })}.`;
      break;
    case 'view_branch_details':
      details = `Viewed details of branch #${faker.number.int({ min: 1, max: 50 })}.`;
      break;
    case 'reset_password':
      details = `Requested password reset.`;
      break;
    case 'add_admin':
      details = `Added admin user #${faker.number.int({ min: 1, max: 50 })} to branch #${faker.number.int({ min: 1, max: 20 })}.`;
      break;
    case 'remove_admin':
      details = `Removed admin user #${faker.number.int({ min: 1, max: 50 })} from branch #${faker.number.int({ min: 1, max: 20 })}.`;
      break;
    case 'update_field':
      details = `Updated field #${faker.number.int({ min: 1, max: 100 })}.`;
      break;
    default:
      details = `Performed action: ${action}.`;
      break;
  }
  
  return {
    userId,
    action,
    details: overrides.details || details,
    ipAddress: overrides.ipAddress || ipAddress,
    createdAt: overrides.createdAt || faker.date.past(),
  };
};

// Factory untuk menghasilkan activity logs
export const createActivityLogs = async (
  prisma: PrismaClient,
  userIds: number[]
) => {
  console.log('Generating activity logs with faker...');
  
  // Hapus semua activity logs yang ada
  await prisma.activityLog.deleteMany({});
  
  const activityLogs: any[] = [];
  
  // Jumlah total log aktivitas (antara 400 dan 800 untuk data chart yang lebih bermakna)
  const logCount = faker.number.int({ min: 400, max: 800 });
  
  // Pastikan distribusi dari tahun 2023-2025
  const years = [2023, 2024, 2025];
  const yearCounts = {
    2023: Math.floor(logCount * 0.25), // 25% dari total
    2024: Math.floor(logCount * 0.40), // 40% dari total
    2025: Math.floor(logCount * 0.35), // 35% dari total
  };
  
  // Distribusi log yang lebih realistis (lebih banyak login, booking, dan payment)
  const actionWeights = {
    'login': 15,
    'logout': 10,
    'create_booking': 20,
    'payment_success': 25,
    'payment_failed': 5,
    'view_fields': 8,
    'view_bookings': 7,
    'other': 10 // sisa aktivitas
  };
  
  // Generate log per tahun
  for (const year of years) {
    const yearLogCount = yearCounts[year as keyof typeof yearCounts];
    
    for (let i = 0; i < yearLogCount; i++) {
      // Pilih user secara acak
      const userId = faker.helpers.arrayElement(userIds);
      
      // Pilih jenis aktivitas dengan bobot yang telah ditentukan
      let action: string;
      const actionRoll = faker.number.float({ min: 0, max: 100 });
      
      if (actionRoll < actionWeights.login) {
        action = 'login';
      } else if (actionRoll < actionWeights.login + actionWeights.logout) {
        action = 'logout';
      } else if (actionRoll < actionWeights.login + actionWeights.logout + actionWeights.create_booking) {
        action = 'create_booking';
      } else if (actionRoll < actionWeights.login + actionWeights.logout + actionWeights.create_booking + actionWeights.payment_success) {
        action = 'payment_success';
      } else if (actionRoll < actionWeights.login + actionWeights.logout + actionWeights.create_booking + actionWeights.payment_success + actionWeights.payment_failed) {
        action = 'payment_failed';
      } else if (actionRoll < actionWeights.login + actionWeights.logout + actionWeights.create_booking + actionWeights.payment_success + actionWeights.payment_failed + actionWeights.view_fields) {
        action = 'view_fields';
      } else if (actionRoll < actionWeights.login + actionWeights.logout + actionWeights.create_booking + actionWeights.payment_success + actionWeights.payment_failed + actionWeights.view_fields + actionWeights.view_bookings) {
        action = 'view_bookings';
      } else {
        // Sisa aktivitas lainnya
        const otherActions = [
          'update_profile',
          'cancel_booking',
          'create_review',
          'update_branch',
          'view_field_details',
          'view_branch_details',
          'reset_password',
          'add_admin',
          'remove_admin',
          'update_field',
        ];
        action = faker.helpers.arrayElement(otherActions);
      }
      
      // Untuk tahun 2023-2024, buat tanggal yang acak dalam tahun tersebut
      let createdAt;
      
      if (year < new Date().getFullYear()) {
        // Untuk tahun lalu, acak bulan dan tanggal
        const randomMonth = faker.number.int({ min: 0, max: 11 });
        const randomDay = faker.number.int({ min: 1, max: 28 });
        createdAt = new Date(year, randomMonth, randomDay);
        
        // Tambahkan jam, menit, detik yang acak
        createdAt.setHours(
          faker.number.int({ min: 0, max: 23 }),
          faker.number.int({ min: 0, max: 59 }),
          faker.number.int({ min: 0, max: 59 })
        );
      } else {
        // Untuk tahun ini, gunakan between dengan batas dari awal tahun sampai hari ini
        const startDate = new Date(year, 0, 1); // 1 Januari tahun ini
        const endDate = new Date(); // Hari ini
        createdAt = faker.date.between({ from: startDate, to: endDate });
      }
      
      // Generate log aktivitas
      const log = await prisma.activityLog.create({
        data: {
          ...generateActivityLog(userId, { action }),
          createdAt
        }
      });
      
      activityLogs.push(log);
    }
  }
  
  // Hitung distribusi tahun aktual
  const yearDistribution = activityLogs.reduce((acc: Record<string, number>, log: any) => {
    const year = log.createdAt.getFullYear();
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`Generated ${activityLogs.length} activity logs with year distribution:`, yearDistribution);
  
  return activityLogs;
}; 