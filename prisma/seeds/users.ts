import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from '../../src/utils/password.utils';

export default async function seedUsers(prisma: PrismaClient) {
  const superAdminHash = await hashPassword("password123");
  const ownerHash = await hashPassword("password123");
  const adminHash = await hashPassword("password123");
  const userHash = await hashPassword("password123");

  const users = await prisma.user.createMany({
    data: [
      { 
        name: "Super Admin",
        email: "superadmin@example.com",
        password: superAdminHash,
        phone: "081234567890",
        role: Role.super_admin
      },
      { 
        name: "Branch Owner",
        email: "owner@example.com",
        password: ownerHash,
        phone: "081234567891",
        role: Role.owner_cabang
      },
      { 
        name: "Branch Admin",
        email: "admin@example.com",
        password: adminHash,
        phone: "081234567892",
        role: Role.admin_cabang
      },
      { 
        name: "Regular User",
        email: "user@example.com",
        password: userHash,
        phone: "081234567893",
        role: Role.user
      }
    ],
    skipDuplicates: true,
  });
  
  // Return the number of users created for reference in other seeds
  return users.count;
}