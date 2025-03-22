import { Request, Response } from 'express';
import prisma from '../../../config/database';
import {
  branchSchema,
  updateBranchSchema,
} from '../../../zod-schemas/branch.schema';
import { deleteCachedDataByPattern } from '../../../utils/cache.utils';

export const getBranches = async (req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
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
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createBranch = async (
  req: Request,
  res: Response,
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
  res: Response,
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
