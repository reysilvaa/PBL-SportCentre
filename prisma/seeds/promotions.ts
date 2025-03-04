import { PrismaClient } from "@prisma/client";

export default async function seedPromotions(prisma: PrismaClient) {
    await prisma.promotion.createMany({
      data: [{ code: "PROMO10", discountPercent: 10, validFrom: new Date(), validUntil: new Date() }],
      skipDuplicates: true,
    });
  }