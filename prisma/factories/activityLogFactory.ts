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
    case 'payment_success':
      details = `Successfully paid booking #${faker.number.int({ min: 1, max: 1000 })} with amount Rp${faker.number.int({ min: 100000, max: 500000 })}.`;
      break;
    case 'payment_failed':
      details = `Failed payment for booking #${faker.number.int({ min: 1, max: 1000 })}.`;
      break;
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
  
  const activityLogs = [];
  
  // Jumlah total log aktivitas (antara 200 dan 500)
  const logCount = faker.number.int({ min: 200, max: 500 });
  
  for (let i = 0; i < logCount; i++) {
    // Pilih user secara acak
    const userId = faker.helpers.arrayElement(userIds);
    
    // Generate log aktivitas
    const log = await prisma.activityLog.create({
      data: generateActivityLog(userId)
    });
    
    activityLogs.push(log);
  }
  
  console.log(`Generated ${activityLogs.length} activity logs.`);
  
  return activityLogs;
}; 