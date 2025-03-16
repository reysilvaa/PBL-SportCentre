import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { branchSchema, updateBranchSchema } from '../../../zod-schemas/branch.schema';

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

export const createBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = branchSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({ 
        error: 'Validasi gagal', 
        details: result.error.format() 
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
    res.status(201).json(newBranch);
  } catch (error) {
    res.status(400).json({ error: 'Gagal membuat cabang' });
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
        details: result.error.format() 
      });
      return;
    }
    
    const updatedBranch = await prisma.branch.update({
      where: { id: parseInt(id) },
      data: result.data,
    });
    res.json(updatedBranch);
  } catch (error) {
    res.status(400).json({ error: 'Gagal memperbarui cabang' });
  }
};

export const deleteBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.branch.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Gagal menghapus cabang' });
  }
};