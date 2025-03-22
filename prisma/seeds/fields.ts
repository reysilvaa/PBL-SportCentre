import { PrismaClient, FieldStatus } from "@prisma/client";

export default async function seedFields(prisma: PrismaClient) {
  // Get all branches
  const branches = await prisma.branch.findMany();
  
  // Get all field types
  const fieldTypes = await prisma.fieldType.findMany();

  if (!branches.length || !fieldTypes.length) {
    throw new Error("Required branches and field types not found");
  }

  const fields = await prisma.field.createMany({
    data: [
      {
        branchId: branches[0].id,
        typeId: fieldTypes.find(ft => ft.name === "Futsal")?.id || fieldTypes[0].id,
        name: "Futsal Field A",
        priceDay: 100000,
        priceNight: 150000,
        status: FieldStatus.available,
        imageUrl: "https://example.com/futsal-field-a.jpg"
      },
      {
        branchId: branches[0].id,
        typeId: fieldTypes.find(ft => ft.name === "Basketball")?.id || fieldTypes[1].id,
        name: "Basketball Court 1",
        priceDay: 120000,
        priceNight: 180000,
        status: FieldStatus.available,
        imageUrl: "https://example.com/basketball-court-1.jpg"
      },
      {
        branchId: branches[1].id,
        typeId: fieldTypes.find(ft => ft.name === "Badminton")?.id || fieldTypes[2].id,
        name: "Badminton Court A",
        priceDay: 80000,
        priceNight: 100000,
        status: FieldStatus.available,
        imageUrl: "https://example.com/badminton-court-a.jpg"
      },
      {
        branchId: branches[1].id,
        typeId: fieldTypes.find(ft => ft.name === "Tennis")?.id || fieldTypes[3].id,
        name: "Tennis Court 1",
        priceDay: 150000,
        priceNight: 200000,
        status: FieldStatus.available,
        imageUrl: "https://example.com/tennis-court-1.jpg"
      }
    ],
    skipDuplicates: true,
  });

  return fields.count;
  }