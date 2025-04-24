import { Request, Response } from 'express';
import prisma from '../../../config/services/database';
import {
  branchSchema,
  updateBranchSchema,
} from '../../../zod-schemas/branch.schema';
import { deleteCachedDataByPattern } from '../../../utils/cache.utils';

export const getBranches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { q, page = '1', limit = '10' } = req.query;

    if (id) {
      // Jika ID disediakan, ambil cabang spesifik
      const branch = await prisma.branch.findUnique({
        where: { id: parseInt(id) },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!branch) {
        res.status(404).json({ error: 'Cabang tidak ditemukan' });
        return;
      }

      res.json(branch);
      return;
    }

    // Jika tidak ada ID, ambil semua cabang dengan filter dan paginasi
    const pageNumber = parseInt(page as string) || 1;
    const limitNumber = parseInt(limit as string) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    // Buat kondisi pencarian jika parameter q ada
    let whereCondition = {};
    if (q) {
      whereCondition = {
        OR: [
          { name: { contains: q as string } },
          { location: { contains: q as string } },
        ],
      };
    }

    // Hitung total data
    const totalItems = await prisma.branch.count({
      where: whereCondition,
    });

    // Ambil data dengan paginasi dan pencarian
    const branches = await prisma.branch.findMany({
      where: whereCondition,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      skip,
      take: limitNumber,
    });

    const totalPages = Math.ceil(totalItems / limitNumber);

    res.json({
      data: branches,
      meta: {
        page: pageNumber,
        limit: limitNumber,
        totalItems,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error('Error in getBranches:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createBranch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = branchSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const { name, location, ownerId, status } = result.data;
    const newBranch = await prisma.branch.create({
      data: {
        name,
        location,
        ownerId,
        status,
      },
    });

    // Hapus cache yang relevan
    deleteCachedDataByPattern('branches');

    res.status(201).json(newBranch);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validasi data dengan Zod
    const result = updateBranchSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const updatedBranch = await prisma.branch.update({
      where: { id: parseInt(id) },
      data: result.data,
    });

    // Hapus cache yang relevan
    deleteCachedDataByPattern('branches');

    res.json(updatedBranch);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const deleteBranch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Cek apakah cabang memiliki lapangan
    const fields = await prisma.field.findFirst({
      where: { branchId: parseInt(id) },
    });

    if (fields) {
      res.status(400).json({
        error: 'Tidak dapat menghapus cabang yang memiliki lapangan',
      });
    }

    await prisma.branch.delete({
      where: { id: parseInt(id) },
    });

    // Hapus cache yang relevan
    deleteCachedDataByPattern('branches');

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
