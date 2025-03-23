import { PrismaClient } from '@prisma/client';

// Singleton instance of PrismaClient
export const prisma = new PrismaClient();

export default prisma;
