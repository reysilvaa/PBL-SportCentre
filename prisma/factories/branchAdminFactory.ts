import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';

// Factory untuk menghasilkan relasi antara branch dan admin
export const createBranchAdmins = async (
  prisma: PrismaClient, 
  branchIds: number[], 
  adminIds: number[]
) => {
  console.log('Generating branch-admin relationships with faker...');
  
  // Hapus semua relasi branch admin yang ada
  await prisma.branchAdmin.deleteMany({});
  
  const branchAdmins = [];
  
  // Memastikan setiap branch memiliki setidaknya 1 admin
  for (const branchId of branchIds) {
    // Jumlah admin untuk cabang ini (antara 1 dan 3)
    const adminCount = faker.number.int({ min: 1, max: 3 });
    
    // Pilih adminCount admin secara acak dari pool admin
    const selectedAdmins = faker.helpers.shuffle([...adminIds]).slice(0, adminCount);
    
    for (const adminId of selectedAdmins) {
      branchAdmins.push({
        branchId,
        userId: adminId
      });
    }
  }
  
  // Tambahkan beberapa admin yang mengelola lebih dari 1 cabang (20% admin)
  const multibranchAdminCount = Math.ceil(adminIds.length * 0.2);
  const multibranchAdmins = faker.helpers.shuffle([...adminIds]).slice(0, multibranchAdminCount);
  
  for (const adminId of multibranchAdmins) {
    // Pilih 1-2 cabang tambahan secara acak
    const additionalBranchCount = faker.number.int({ min: 1, max: 2 });
    const additionalBranches = faker.helpers.shuffle([...branchIds]).slice(0, additionalBranchCount);
    
    for (const branchId of additionalBranches) {
      // Hindari duplikasi dengan memeriksa apakah relasi sudah ada
      const exists = branchAdmins.some(ba => ba.branchId === branchId && ba.userId === adminId);
      
      if (!exists) {
        branchAdmins.push({
          branchId,
          userId: adminId
        });
      }
    }
  }
  
  // Buat relasi branch-admin
  await prisma.branchAdmin.createMany({
    data: branchAdmins,
    skipDuplicates: true,
  });
  
  console.log(`Generated ${branchAdmins.length} branch-admin relationships.`);
  
  return branchAdmins;
}; 