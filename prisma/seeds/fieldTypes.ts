import { PrismaClient } from "@prisma/client";

export default async function seedFieldTypes(prisma: PrismaClient) {
    await prisma.fieldType.createMany({
      data: [{ name: "Futsal" }, { name: "Basketball" }],
      skipDuplicates: true,
    });
  }
  