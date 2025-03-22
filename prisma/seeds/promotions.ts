import { PrismaClient, PromotionStatus } from "@prisma/client";

export default async function seedPromotions(prisma: PrismaClient) {
  const promotions = await prisma.promotion.createMany({
    data: [
      {
        code: "WELCOME2024",
        description: "New Year Special Discount",
        discountPercent: 10,
        maxDiscount: 50000,
        validFrom: new Date("2024-01-01"),
        validUntil: new Date("2024-12-31"),
        status: PromotionStatus.active
      },
      {
        code: "WEEKEND25",
        description: "Weekend Special Offer",
        discountPercent: 25,
        maxDiscount: 100000,
        validFrom: new Date("2024-01-01"),
        validUntil: new Date("2024-06-30"),
        status: PromotionStatus.active
      },
      {
        code: "FLASH50",
        description: "Flash Sale Discount",
        discountPercent: 50,
        maxDiscount: 200000,
        validFrom: new Date("2024-02-01"),
        validUntil: new Date("2024-02-07"),
        status: PromotionStatus.expired
      }
    ],
    skipDuplicates: true,
  });

  return promotions.count;
  }