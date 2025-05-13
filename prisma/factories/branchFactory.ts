import { PrismaClient, Branch, BranchStatus } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';

// Fungsi untuk menghasilkan branch tunggal
export const generateBranch = (ownerId: number, overrides: Partial<Branch> = {}): Omit<Branch, 'id'> => {
  const cities = [
    'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 
    'Yogyakarta', 'Malang', 'Denpasar', 'Palembang'
  ];
  
  const randomCity = faker.helpers.arrayElement(cities);
  const sportCenterName = `Sport Center ${randomCity} ${faker.location.street()}`;
  
  return {
    name: overrides.name || sportCenterName,
    location: overrides.location || `${faker.location.streetAddress()}, ${randomCity}, ${faker.location.state()}`,
    imageUrl: overrides.imageUrl || faker.image.urlLoremFlickr({ category: 'sports' }),
    ownerId: ownerId,
    status: overrides.status || BranchStatus.active,
    createdAt: overrides.createdAt || faker.date.past(),
  };
};

// Factory untuk menghasilkan banyak branches
export const createBranches = async (prisma: PrismaClient, ownerIds: number[]) => {
  console.log('Generating branches with faker...');
  
  // Hapus semua branch_admin dan branch yang ada untuk fresh start
  await prisma.branchAdmin.deleteMany({});
  await prisma.branch.deleteMany({});
  
  // Distribusi cabang per owner
  // Setiap owner memiliki 2-4 cabang
  const branches = [];
  
  for (const ownerId of ownerIds) {
    // Jumlah cabang untuk owner ini (antara 2 dan 4)
    const branchCount = faker.number.int({ min: 2, max: 4 });
    
    for (let i = 0; i < branchCount; i++) {
      // 10% kemungkinan cabang inactive
      const status = faker.helpers.maybe(() => BranchStatus.inactive, { probability: 0.1 }) || BranchStatus.active;
      
      const branch = await prisma.branch.create({
        data: generateBranch(ownerId, { status })
      });
      
      branches.push(branch);
    }
  }
  
  console.log(`Generated ${branches.length} branches.`);
  
  return branches;
}; 