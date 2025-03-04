
// src/services/userService.ts
import prisma from '../config/database';

export const findUserById = async (id: number) => {
  return prisma.user.findUnique({ where: { id } });
};