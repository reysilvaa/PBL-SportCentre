import { Request, Response } from 'express';
import { validate } from 'class-validator';
import prisma from '../config/database';
import { CreateBranchDto } from '../dto/branch/create-branch.dto';

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
    const createBranchDto = new CreateBranchDto();
    Object.assign(createBranchDto, req.body);

    const errors = await validate(createBranchDto);
    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return; 
    }

    const { name, location, ownerId } = createBranchDto;
    const newBranch = await prisma.branch.create({
      data: {
        name,
        location,
        ownerId,
        status: req.body.status || 'active',
      },
    });
    res.status(201).json(newBranch);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create branch' });
  }
};

export const updateBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, location, status } = req.body;
    const updatedBranch = await prisma.branch.update({
      where: { id: parseInt(id) },
      data: {
        name,
        location,
        status,
      },
    });
    res.json(updatedBranch);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update branch' });
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
    res.status(400).json({ error: 'Failed to delete branch' });
  }
};