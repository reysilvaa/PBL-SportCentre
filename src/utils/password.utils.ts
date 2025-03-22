import * as argon2 from 'argon2';

/**
 * Menghasilkan hash dari password menggunakan Argon2 (tanpa perlu salt manual)
 * @param password Password yang akan di-hash
 * @returns Hash password dalam format Argon2
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4
  });
};

/**
 * Memverifikasi apakah password cocok dengan hash menggunakan Argon2
 * @param password Password yang akan diverifikasi
 * @param hashedPassword Password hash yang tersimpan
 * @returns Boolean yang menunjukkan apakah password cocok
 */
export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await argon2.verify(hashedPassword, password);
};
