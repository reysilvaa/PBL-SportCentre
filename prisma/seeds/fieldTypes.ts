import { PrismaClient } from '@prisma/client';

export default async function seedFieldTypes(prisma: PrismaClient) {
  const fieldTypes = await prisma.fieldType.createMany({
    data: [
      { name: 'Futsal' },
      { name: 'Basketball' },
      { name: 'Badminton' },
      { name: 'Tennis' },
      { name: 'Volleyball' },
      { name: 'Mini Soccer' },
    ],
    skipDuplicates: true,
  });

  return fieldTypes.count;
}
