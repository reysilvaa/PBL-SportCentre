import { PrismaClient, FieldType } from '@prisma/client';

// Data field types yang relevan dalam konteks Indonesia
const fieldTypes = [
  { name: 'Futsal' },
  { name: 'Basket' },
  { name: 'Badminton' },
  { name: 'Tenis' },
  { name: 'Voli' },
  { name: 'Sepak Bola Mini' },
  { name: 'Tenis Meja' },
];

// Factory untuk menghasilkan field types
export const createFieldTypes = async (prisma: PrismaClient) => {
  console.log('Generating field types...');
  
  // Hapus semua field types yang ada
  await prisma.fieldType.deleteMany({});
  
  const createdFieldTypes = [];
  
  // Membuat field types
  for (const fieldType of fieldTypes) {
    const createdType = await prisma.fieldType.create({
      data: fieldType,
    });
    createdFieldTypes.push(createdType);
  }
  
  console.log(`Generated ${createdFieldTypes.length} field types.`);
  
  return createdFieldTypes;
}; 