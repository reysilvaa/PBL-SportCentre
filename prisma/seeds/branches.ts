import { PrismaClient } from "@prisma/client";

export default async function seedBranches(prisma: PrismaClient) {
    await prisma.branch.createMany({
      data: [{ name: "Branch 1", location: "Jakarta", ownerId: 2 }],
      skipDuplicates: true,
    });
  }
  