import { PrismaClient, FieldReview } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/id_ID';

// Fungsi untuk menghasilkan review lapangan tunggal
export const generateFieldReview = (
  userId: number,
  fieldId: number,
  overrides: Partial<FieldReview> = {}
): Omit<FieldReview, 'id'> => {
  // Rating antara 1 dan 5
  const rating = overrides.rating || faker.number.int({ min: 1, max: 5 });
  
  // Review text
  const reviewTexts: Record<number, string[]> = {
    1: [
      'Lapangan dalam kondisi sangat buruk.',
      'Pelayanan buruk dan lapangan tidak terawat.',
      'Kecewa dengan fasilitas di lapangan ini.',
      'Tidak akan booking lagi di sini.',
      'Lapangan kotor dan licin.',
    ],
    2: [
      'Pelayanannya kurang memuaskan.',
      'Lapangan cukup bersih tapi fasilitasnya kurang.',
      'Harga tidak sebanding dengan kualitas.',
      'Petugas kurang ramah.',
      'Akses ke lokasi sulit.',
    ],
    3: [
      'Cukup baik untuk bermain casual.',
      'Standar, tidak ada yang spesial.',
      'Fasilitas cukup memadai.',
      'Pelayanan biasa saja.',
      'Lokasi strategis tapi lapangan biasa saja.',
    ],
    4: [
      'Lapangan bagus dan terawat.',
      'Pelayanannya ramah dan profesional.',
      'Fasilitas lengkap dan bersih.',
      'Worth it dengan harganya.',
      'Akan booking lagi di sini.',
    ],
    5: [
      'Lapangan terbaik yang pernah saya gunakan!',
      'Sangat puas dengan pelayanan dan fasilitasnya.',
      'Kondisi lapangan sangat prima.',
      'Sangat recommended untuk bermain di sini.',
      'Fasilitas lengkap dan pelayanan sangat memuaskan.',
    ],
  };
  
  // Pilih review text berdasarkan rating
  const reviewText = overrides.review !== undefined 
    ? overrides.review 
    : faker.helpers.arrayElement(reviewTexts[rating] || ['Pengalaman bermain yang menyenangkan']);
  
  return {
    userId,
    fieldId,
    rating,
    review: reviewText,
    createdAt: overrides.createdAt || faker.date.past(),
  };
};

// Factory untuk menghasilkan reviews
export const createFieldReviews = async (
  prisma: PrismaClient,
  bookings: { userId: number, fieldId: number }[]
) => {
  console.log('Generating field reviews with faker...');
  
  // Hapus semua reviews yang ada
  await prisma.fieldReview.deleteMany({});
  
  const reviews = [];
  
  // Hanya 60% booking yang memberikan review
  const bookingsWithReviews = faker.helpers.arrayElements(
    bookings,
    Math.floor(bookings.length * 0.6)
  );
  
  // Mencegah user memberikan review yang sama pada lapangan yang sama
  const reviewKeys = new Set();
  
  for (const booking of bookingsWithReviews) {
    const key = `${booking.userId}-${booking.fieldId}`;
    
    // Skip jika user sudah memberikan review untuk lapangan ini
    if (reviewKeys.has(key)) continue;
    
    reviewKeys.add(key);
    
    const review = await prisma.fieldReview.create({
      data: generateFieldReview(booking.userId, booking.fieldId)
    });
    
    reviews.push(review);
  }
  
  console.log(`Generated ${reviews.length} field reviews.`);
  return reviews;
}; 