import { PrismaClient, Field, FieldStatus } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';
import { Decimal } from '@prisma/client/runtime/library';

// Fungsi untuk menghasilkan field tunggal
export const generateField = (
  branchId: number, 
  typeId: number, 
  overrides: Partial<Field> = {}
): Omit<Field, 'id'> => {
  // Buat nama field yang relevan berdasarkan tipe
  let typeName = '';
  
  // Beberapa nama berdasarkan tipe lapangan
  const fieldNames = {
    1: ['Futsal A', 'Futsal B', 'Futsal Indoor', 'Futsal Outdoor'],
    2: ['Basket A', 'Basket B', 'Basket Indoor', 'Basket Outdoor'],
    3: ['Badminton A', 'Badminton B', 'Badminton C', 'Badminton Indoor'],
    4: ['Tenis A', 'Tenis B', 'Tenis Indoor', 'Tenis Outdoor'],
    5: ['Voli A', 'Voli B', 'Voli Indoor', 'Voli Outdoor'],
    6: ['Sepak Bola Mini A', 'Sepak Bola Mini B'],
    7: ['Tenis Meja A', 'Tenis Meja B', 'Tenis Meja C'],
  };
  
  // Pilih nama sesuai tipe, atau default ke nama generik jika tipe tidak dikenali
  const names = fieldNames[typeId as keyof typeof fieldNames] || ['Lapangan A', 'Lapangan B'];
  typeName = faker.helpers.arrayElement(names);
  
  // Harga siang dan malam hari bervariasi berdasarkan tipe lapangan
  // Futsal, Basket, Badminton lebih mahal daripada yang lain
  let basePriceDay = 0;
  switch (typeId) {
    case 1: // Futsal
      basePriceDay = faker.number.int({ min: 150000, max: 200000 });
      break;
    case 2: // Basket
      basePriceDay = faker.number.int({ min: 180000, max: 250000 });
      break;
    case 3: // Badminton
      basePriceDay = faker.number.int({ min: 80000, max: 120000 });
      break;
    default:
      basePriceDay = faker.number.int({ min: 50000, max: 150000 });
  }
  
  // Harga malam biasanya lebih mahal 20-40% dari harga siang
  const priceNightIncrease = 1 + faker.number.float({ min: 0.2, max: 0.4 });
  const priceNight = Math.round(basePriceDay * priceNightIncrease);
  
  return {
    branchId,
    typeId,
    name: overrides.name || typeName,
    priceDay: overrides.priceDay || new Decimal(basePriceDay),
    priceNight: overrides.priceNight || new Decimal(priceNight),
    status: overrides.status || FieldStatus.available,
    imageUrl: overrides.imageUrl || 'https://unggulsportscenter.com/assets/img/facilities/lapangan_badminton.JPG',
    createdAt: overrides.createdAt || faker.date.past(),
  };
};

// Factory untuk menghasilkan banyak fields
export const createFields = async (
  prisma: PrismaClient, 
  branches: { id: number }[], 
  fieldTypes: { id: number }[]
) => {
  console.log('Generating fields with faker...');
  
  // Hapus semua fields yang ada
  await prisma.field.deleteMany({});
  
  const fields = [];
  
  // Untuk setiap cabang, buat beberapa lapangan dari berbagai tipe
  for (const branch of branches) {
    // Jumlah lapangan per cabang (antara 3 dan 8)
    const fieldCount = faker.number.int({ min: 3, max: 8 });
    
    // Pilih beberapa tipe lapangan secara acak untuk cabang ini
    const selectedTypes = faker.helpers.shuffle([...fieldTypes])
      .slice(0, faker.number.int({ min: 1, max: Math.min(fieldTypes.length, 4) }));
    
    // Buat fields untuk cabang ini
    for (let i = 0; i < fieldCount; i++) {
      // Pilih tipe secara acak dari tipe yang sudah dipilih untuk cabang ini
      const fieldType = faker.helpers.arrayElement(selectedTypes);
      
      // 10% kemungkinan lapangan dalam maintenance
      const status = faker.helpers.maybe(() => FieldStatus.maintenance, { probability: 0.1 }) || FieldStatus.available;
      
      const field = await prisma.field.create({
        data: generateField(branch.id, fieldType.id, { status })
      });
      
      fields.push(field);
    }
  }
  
  console.log(`Generated ${fields.length} fields.`);
  
  return fields;
}; 