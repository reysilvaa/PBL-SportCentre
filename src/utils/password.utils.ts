import bcrypt from 'bcryptjs';

/**
 * Menghasilkan hash dari password dengan salt
 * @param password Password yang akan di-hash
 * @returns Password yang sudah di-hash dengan salt
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Memverifikasi apakah password cocok dengan hash
 * @param password Password yang akan diverifikasi
 * @param hashedPassword Password hash yang tersimpan
 * @returns Boolean yang menunjukkan apakah password cocok
 */
export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
}; 