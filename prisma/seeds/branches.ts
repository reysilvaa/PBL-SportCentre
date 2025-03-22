import { PrismaClient, BranchStatus } from "@prisma/client";

export default async function seedBranches(prisma: PrismaClient) {
  // Get the owner user (role: owner_cabang)
  const owner = await prisma.user.findFirst({
    where: { role: "owner_cabang" }
  });

  const admin = await prisma.user.findFirst({
    where: { role: "admin_cabang" }
  });

  if (!owner || !admin) {
    throw new Error("Required users not found");
  }

  // Create branches
  const branches = await prisma.branch.createMany({
    data: [
      { 
        name: "Sport Center Malang",
        location: "Jl. Soekarno Hatta No. 9, Malang",
        imageUrl: "https://example.com/sport-center-malang.jpg",
        ownerId: owner.id,
        status: BranchStatus.active
      },
      { 
        name: "Sport Center Surabaya",
        location: "Jl. Ahmad Yani No. 15, Surabaya",
        imageUrl: "https://example.com/sport-center-surabaya.jpg",
        ownerId: owner.id,
        status: BranchStatus.active
      }
    ],
    skipDuplicates: true,
  });

  // Create branch admin relationships
  const branchList = await prisma.branch.findMany();
  for (const branch of branchList) {
    await prisma.branchAdmin.create({
      data: {
        branchId: branch.id,
        userId: admin.id
      }
    });
  }

  return branches.count;
  }
  