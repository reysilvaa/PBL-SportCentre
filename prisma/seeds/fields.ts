import { PrismaClient } from "@prisma/client";

// seeds/fields.ts
export default async function seedFields(prisma: PrismaClient) {
    await prisma.field.createMany({
      data: [{ branchId: 1, typeId: 1, name: "Lapangan A", priceDay: 100000, priceNight: 150000 }],
      skipDuplicates: true,
    });
  }