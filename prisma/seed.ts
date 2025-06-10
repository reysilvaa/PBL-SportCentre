import { PrismaClient } from '@prisma/client';
import { Role, PaymentStatus, PaymentMethod } from '@prisma/client';
import { hashPassword } from '../src/utils/password.utils';
import { calculateTotalPrice } from '../src/utils/booking/calculateBooking.utils';
import { addDays, format, parseISO } from 'date-fns';
import { combineDateAndTime } from '../src/utils/date.utils';

const prisma = new PrismaClient();

/**
 * Fungsi untuk menghapus data pengujian tertentu
 */
async function cleanTestData() {
  console.log('Membersihkan data pengujian...');
  
  // Hapus data spesifik untuk pengujian
  await prisma.payment.deleteMany({
    where: {
      booking: {
        user: {
          email: {
            in: ['testuser@example.com', 'testuser2@example.com']
          }
        }
      }
    }
  });
  
  await prisma.booking.deleteMany({
    where: {
      user: {
        email: {
          in: ['testuser@example.com', 'testuser2@example.com']
        }
      }
    }
  });
  
  await prisma.field.deleteMany({
    where: {
      name: {
        startsWith: 'Test Field'
      }
    }
  });
  
  await prisma.branch.deleteMany({
    where: {
      name: {
        startsWith: 'Test Branch'
      }
    }
  });
  
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['testuser@example.com', 'testuser2@example.com', 'testadmin@example.com', 'testowner@example.com']
      }
    }
  });
  
  console.log('Data pengujian berhasil dibersihkan!');
}

/**
 * Fungsi utama untuk seeding data pengujian
 */
async function main() {
  console.log('🌱 Memulai proses seeding data pengujian...');
  
  try {
    // Bersihkan data pengujian terlebih dahulu
    await cleanTestData();
    
    // 1. Buat user untuk pengujian
    const commonPassword = await hashPassword('password123');
    
    const testUser = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'testuser@example.com',
        password: commonPassword,
        phone: '081234567890',
        role: Role.user
      }
    });
    
    const testUser2 = await prisma.user.create({
      data: {
        name: 'Test User 2',
        email: 'testuser2@example.com',
        password: commonPassword,
        phone: '081234567891',
        role: Role.user
      }
    });
    
    const testAdmin = await prisma.user.create({
      data: {
        name: 'Test Admin',
        email: 'testadmin@example.com',
        password: commonPassword,
        phone: '081234567892',
        role: Role.admin_cabang
      }
    });
    
    const testOwner = await prisma.user.create({
      data: {
        name: 'Test Owner',
        email: 'testowner@example.com',
        password: commonPassword,
        phone: '081234567893',
        role: Role.owner_cabang
      }
    });
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@example.com',
        password: commonPassword,
        phone: '081234567894',
        role: Role.super_admin
      }
    });
    
    console.log('✅ Users created');
    
    // 2. Buat branch untuk pengujian
    const testBranch = await prisma.branch.create({
      data: {
        name: 'Test Branch',
        location: 'Jl. Test No. 123, Malang',
        imageUrl: 'https://picsum.photos/800/600',
        ownerId: testOwner.id
      }
    });
    
    console.log('✅ Branch created');
    
    // 3. Hubungkan admin dengan branch
    await prisma.branchAdmin.create({
      data: {
        branchId: testBranch.id,
        userId: testAdmin.id
      }
    });
    
    console.log('✅ Branch admin relationship created');
    
    // 4. Buat field type
    const fieldType = await prisma.fieldType.create({
      data: {
        name: 'Futsal',
      }
    });
    
    console.log('✅ Field type created');
    
    // 5. Buat field untuk pengujian
    const testField = await prisma.field.create({
      data: {
        name: 'Test Field 1',
        priceDay: 100000,
        priceNight: 150000,
        imageUrl: 'https://picsum.photos/800/600',
        branchId: testBranch.id,
        typeId: fieldType.id
      }
    });
    
    console.log('✅ Field created');
    
    // 6. Buat booking untuk pengujian
    // Booking 1: Dengan DP_PAID
    const today = new Date();
    const bookingDate = format(addDays(today, 1), 'yyyy-MM-dd');
    const startTime = '10:00';
    const endTime = '12:00';
    
    const startDateTime = combineDateAndTime(parseISO(bookingDate), startTime);
    const endDateTime = combineDateAndTime(parseISO(bookingDate), endTime);
    
    const totalPrice = calculateTotalPrice(
      startDateTime,
      endDateTime,
      Number(testField.priceDay),
      Number(testField.priceNight)
    );
    
    const booking1 = await prisma.booking.create({
      data: {
        userId: testUser.id,
        fieldId: testField.id,
        bookingDate: parseISO(bookingDate),
        startTime: startDateTime,
        endTime: endDateTime
      }
    });
    
    // Payment untuk booking 1 (DP_PAID)
    await prisma.payment.create({
      data: {
        bookingId: booking1.id,
        userId: testUser.id,
        amount: totalPrice / 2, // Setengah dari total harga
        status: PaymentStatus.dp_paid,
        paymentMethod: PaymentMethod.bca_va,
        transactionId: 'test-transaction-1'
      }
    });
    
    console.log('✅ Booking 1 with DP_PAID created');
    
    // Booking 2: Dengan PAID
    const bookingDate2 = format(addDays(today, 2), 'yyyy-MM-dd');
    const startTime2 = '14:00';
    const endTime2 = '16:00';
    
    const startDateTime2 = combineDateAndTime(parseISO(bookingDate2), startTime2);
    const endDateTime2 = combineDateAndTime(parseISO(bookingDate2), endTime2);
    
    const totalPrice2 = calculateTotalPrice(
      startDateTime2,
      endDateTime2,
      Number(testField.priceDay),
      Number(testField.priceNight)
    );
    
    const booking2 = await prisma.booking.create({
      data: {
        userId: testUser2.id,
        fieldId: testField.id,
        bookingDate: parseISO(bookingDate2),
        startTime: startDateTime2,
        endTime: endDateTime2
      }
    });
    
    // Payment untuk booking 2 (PAID)
    await prisma.payment.create({
      data: {
        bookingId: booking2.id,
        userId: testUser2.id,
        amount: totalPrice2, // Full payment
        status: PaymentStatus.paid,
        paymentMethod: PaymentMethod.credit_card,
        transactionId: 'test-transaction-2'
      }
    });
    
    console.log('✅ Booking 2 with PAID created');
    
    // Booking 3: Dengan DP_PAID dan pelunasan PAID
    const bookingDate3 = format(addDays(today, 3), 'yyyy-MM-dd');
    const startTime3 = '16:00';
    const endTime3 = '18:00';
    
    const startDateTime3 = combineDateAndTime(parseISO(bookingDate3), startTime3);
    const endDateTime3 = combineDateAndTime(parseISO(bookingDate3), endTime3);
    
    const totalPrice3 = calculateTotalPrice(
      startDateTime3,
      endDateTime3,
      Number(testField.priceDay),
      Number(testField.priceNight)
    );
    
    const booking3 = await prisma.booking.create({
      data: {
        userId: testUser.id,
        fieldId: testField.id,
        bookingDate: parseISO(bookingDate3),
        startTime: startDateTime3,
        endTime: endDateTime3
      }
    });
    
    // Payment DP untuk booking 3
    await prisma.payment.create({
      data: {
        bookingId: booking3.id,
        userId: testUser.id,
        amount: totalPrice3 / 2, // Setengah dari total harga
        status: PaymentStatus.dp_paid,
        paymentMethod: PaymentMethod.bca_va,
        transactionId: 'test-transaction-3-dp'
      }
    });
    
    // Payment pelunasan untuk booking 3
    await prisma.payment.create({
      data: {
        bookingId: booking3.id,
        userId: testUser.id,
        amount: totalPrice3 / 2, // Setengah dari total harga
        status: PaymentStatus.paid,
        paymentMethod: PaymentMethod.bca_va,
        transactionId: 'test-transaction-3-pelunasan'
      }
    });
    
    console.log('✅ Booking 3 with DP_PAID and PAID created');
    
    console.log('✅ Seeding data pengujian berhasil!');
  } catch (error) {
    console.error('❌ Seeding gagal:', error);
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