import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export default async function seedUsers(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.createMany({
    data: [
      { name: "Super Admin", email: "admin@example.com", password: passwordHash, role: "super_admin" },
      { name: "Owner Cabang", email: "owner@example.com", password: passwordHash, role: "owner_cabang" },
    ],
    skipDuplicates: true,
  });
}
