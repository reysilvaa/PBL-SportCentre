import { PrismaClient } from "@prisma/client";

// seeds/fieldReviews.ts
export default async function seedFieldReviews(prisma: PrismaClient) {
    await prisma.fieldReview.createMany({
      data: [{ userId: 1, fieldId: 1, rating: 5, review: "Great field!" }],
      skipDuplicates: true,
    });
  }
  