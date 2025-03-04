import { PrismaClient } from "@prisma/client";

// seeds/promotionUsages.ts
export default async function seedPromotionUsages(prisma: PrismaClient) {
    await prisma.promotionUsage.createMany({
      data: [{ userId: 1, bookingId: 1, promoId: 1 }],
      skipDuplicates: true,
    });
  }
  