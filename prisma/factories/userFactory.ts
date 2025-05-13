import { PrismaClient, Role, User } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';
import { hashPassword } from '../../src/utils/password.utils';

// Fungsi untuk menghasilkan user tunggal
export const generateUser = async (
  role: Role = Role.user,
  overrides: Partial<User> = {}
): Promise<Omit<User, 'id'>> => {
  const commonPassword = await hashPassword('password123');
  
  return {
    name: overrides.name || faker.person.fullName(),
    email: overrides.email || faker.internet.email().toLowerCase(),
    password: overrides.password || commonPassword,
    phone: overrides.phone || `08${faker.string.numeric(10)}`,
    role: role,
    createdAt: overrides.createdAt || faker.date.past(),
  };
};

// Factory untuk menghasilkan banyak user
export const createUsers = async (prisma: PrismaClient) => {
  console.log('Generating users with faker...');
  
  // Hapus semua user yang ada untuk fresh start
  await prisma.user.deleteMany({});
  
  // Membuat Super Admin (1)
  const superAdmin = await prisma.user.create({
    data: await generateUser(Role.super_admin, {
      name: 'Super Admin',
      email: 'superadmin@example.com',
    }),
  });
  
  // Membuat Owner Cabang (5)
  const owners = [];
  for (let i = 0; i < 5; i++) {
    const owner = await prisma.user.create({
      data: await generateUser(Role.owner_cabang, {
        name: faker.person.fullName(),
        email: `owner${i+1}@sportcenter.com`,
      }),
    });
    owners.push(owner);
  }
  
  // Membuat Admin Cabang (15)
  const admins = [];
  for (let i = 0; i < 15; i++) {
    const admin = await prisma.user.create({
      data: await generateUser(Role.admin_cabang, {
        name: faker.person.fullName(),
        email: `admin${i+1}@sportcenter.com`,
      }),
    });
    admins.push(admin);
  }
  
  // Membuat Regular Users (30)
  const regularUsers = [];
  for (let i = 0; i < 30; i++) {
    const user = await prisma.user.create({
      data: await generateUser(Role.user),
    });
    regularUsers.push(user);
  }
  
  console.log(`Generated ${1 + owners.length + admins.length + regularUsers.length} users.`);
  
  return {
    superAdmin,
    owners,
    admins,
    regularUsers,
    allUsers: [superAdmin, ...owners, ...admins, ...regularUsers],
  };
}; 