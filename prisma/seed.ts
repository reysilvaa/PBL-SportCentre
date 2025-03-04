import { PrismaClient } from "@prisma/client";
import seedUsers from "./seeds/users";
import seedBranches from "./seeds/branches";
import seedFieldTypes from "./seeds/fieldTypes";
import seedFields from "./seeds/fields";
import seedBookings from "./seeds/bookings";
import seedPayments from "./seeds/payments";
import seedActivityLogs from "./seeds/activityLogs";
import seedFieldReviews from "./seeds/fieldReviews";
import seedPromotions from "./seeds/promotions";
import seedPromotionUsages from "./seeds/promotionUsages";

const prisma = new PrismaClient();

async function main() {
  await seedUsers(prisma);
  await seedBranches(prisma);
  await seedFieldTypes(prisma);
  await seedFields(prisma);
  await seedBookings(prisma);
  await seedPayments(prisma);
  await seedActivityLogs(prisma);
  await seedFieldReviews(prisma);
  await seedPromotions(prisma);
  await seedPromotionUsages(prisma);

  console.log("Seeding selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });