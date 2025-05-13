import { PrismaClient } from '@prisma/client';
import { createUsers } from './userFactory';
import { createBranches } from './branchFactory';
import { createBranchAdmins } from './branchAdminFactory';
import { createFieldTypes } from './fieldTypeFactory';
import { createFields } from './fieldFactory';
import { createBookings } from './bookingFactory';
import { createPayments } from './paymentFactory';
import { createPromotions, createPromotionUsages } from './promotionFactory';
import { createFieldReviews } from './fieldReviewFactory';
import { createNotifications } from './notificationFactory';
import { createActivityLogs } from './activityLogFactory';

const prisma = new PrismaClient();

/**
 * Fungsi untuk menghapus semua data dari database 
 * dalam urutan yang benar agar tidak terjadi konflik foreign key
 */
async function cleanDatabase() {
  console.log('Membersihkan database...');
  
  // Hapus data dalam urutan terbalik dari hubungan foreign key
  await prisma.promotionUsage.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.fieldReview.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.field.deleteMany();
  await prisma.branchAdmin.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.fieldType.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.user.deleteMany();
  
  console.log('Database berhasil dibersihkan!');
}

/**
 * Fungsi utama untuk menjalankan semua factory
 */
async function main() {
  console.log('🌱 Memulai proses seeding database dengan faker...');
  
  try {
    // Bersihkan database terlebih dahulu
    await cleanDatabase();
    
    // 1. Membuat users 
    const { owners, admins, regularUsers, allUsers } = await createUsers(prisma);
    const ownerIds = owners.map((owner) => owner.id);
    const adminIds = admins.map((admin) => admin.id);
    const userIds = allUsers.map((user) => user.id);
    const regularUserIds = regularUsers.map((user) => user.id);
    
    // 2. Membuat branches
    const branches = await createBranches(prisma, ownerIds);
    const branchIds = branches.map((branch) => branch.id);
    
    // 3. Membuat branch-admin relationships
    await createBranchAdmins(prisma, branchIds, adminIds);
    
    // 4. Membuat field types
    const fieldTypes = await createFieldTypes(prisma);
    
    // 5. Membuat fields
    const fields = await createFields(prisma, branches, fieldTypes);
    
    // 6. Membuat bookings (untuk user reguler)
    const bookings = await createBookings(prisma, regularUserIds, fields);
    
    // 7. Membuat payments
    await createPayments(prisma, bookings);
    
    // 8. Membuat promotions
    const promotions = await createPromotions(prisma);
    
    // 9. Membuat promotion usages
    await createPromotionUsages(prisma, bookings, promotions);
    
    // 10. Membuat field reviews
    await createFieldReviews(prisma, bookings);
    
    // 11. Membuat notifications
    await createNotifications(prisma, userIds);
    
    // 12. Membuat activity logs
    await createActivityLogs(prisma, userIds);
    
    console.log('✅ Seeding berhasil!');
  } catch (error) {
    console.error('❌ Seeding gagal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Jalankan seeder
main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  }); 