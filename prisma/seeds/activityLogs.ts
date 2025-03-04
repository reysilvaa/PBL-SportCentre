import { PrismaClient } from "@prisma/client";

// seeds/activityLogs.ts
export default async function seedActivityLogs(prisma: PrismaClient) {
    await prisma.activityLog.createMany({
      data: [{ userId: 1, action: "Created a booking" }],
      skipDuplicates: true,
    });
  }