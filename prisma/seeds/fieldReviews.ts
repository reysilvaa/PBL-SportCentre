import { PrismaClient } from '@prisma/client';

export default async function seedFieldReviews(prisma: PrismaClient) {
  // Get user and fields
  const user = await prisma.user.findFirst({
    where: { role: 'user' },
  });

  const fields = await prisma.field.findMany();

  if (!user || !fields.length) {
    throw new Error('Required user and fields not found');
  }

  const fieldReviews = await prisma.fieldReview.createMany({
    data: [
      {
        userId: user.id,
        fieldId: fields[0].id,
        rating: 5,
        review:
          'Excellent futsal field! The surface is well-maintained and perfect for playing. Great lighting for night games.',
        createdAt: new Date('2024-01-15T18:00:00Z'),
      },
      {
        userId: user.id,
        fieldId: fields[1].id,
        rating: 4,
        review:
          'Good basketball court with proper markings. Could use better lighting for evening games.',
        createdAt: new Date('2024-01-16T21:30:00Z'),
      },
      {
        userId: user.id,
        fieldId: fields[2].id,
        rating: 5,
        review:
          'Perfect badminton court! Clean, well-lit, and great flooring. Will definitely come back!',
        createdAt: new Date('2024-01-17T10:30:00Z'),
      },
    ],
    skipDuplicates: true,
  });

  return fieldReviews.count;
}
