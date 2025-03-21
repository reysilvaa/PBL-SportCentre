import { Response } from 'express';
import prisma from '../../../config/database';
import { updateBranchSchema } from '../../../zod-schemas/branch.schema';
import { MulterRequest } from '../../../middlewares/multer.middleware';
import { cleanupUploadedFile } from '../../../utils/cloudinary.utils';
import { User } from '../../../middlewares/auth.middleware';
import { deleteCachedDataByPattern } from '../../../utils/cache.utils';

export const updateBranch = async (req: MulterRequest & User, res: Response): Promise<void> => {
  if (res.headersSent) return;
  
  try {
    const { id } = req.params;
    const branchId = parseInt(id);
    
    if (isNaN(branchId)) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      
      res.status(400).json({
        status: false,
        message: 'Invalid branch ID'
      });
      return;
    }
    
    // Get branch ID from middleware
    const userBranch = req.userBranch;
    
    if (!userBranch) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      
      res.status(400).json({
        status: false,
        message: 'Branch ID is required'
      });
      return;
    }
    
    // Validate the request body
    const validationResult = updateBranchSchema.safeParse({ 
      name: req.body.name, 
      location: req.body.location, 
      status: req.body.status,
      imageUrl: req.file?.path || undefined
    });
    
    if (!validationResult.success) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      res.status(400).json({
        status: false,
        message: 'Validasi gagal',
        error: validationResult.error.format()
      });
      return;
    }

    // Check if branch exists and belongs to the user's branch
    const existingBranch = await prisma.branch.findFirst({
      where: { 
        id: branchId,
        OR: [
          { ownerId: req.user!.id }, // Check if user is owner
          {
            admins: {
              some: {
                userId: req.user!.id
              }
            }
          } // Check if user is admin
        ]
      },
      include: {
        admins: true
      }
    });

    if (!existingBranch) {
      // Clean up uploaded file if exists
      if (req.file?.path) {
        await cleanupUploadedFile(req.file.path);
      }
      res.status(404).json({ 
        status: false,
        message: 'Branch not found or you do not have permission to update this branch'
      });
      return;
    }

    // Prepare update data
    const updateData = {
      name: validationResult.data.name,
      location: validationResult.data.location,
      status: validationResult.data.status,
    };

    // Handle image update
    if (req.file?.path) {
      (updateData as { imageUrl?: string }).imageUrl = req.file.path;
      // Clean up old image if exists
      if (existingBranch.imageUrl) {
        await cleanupUploadedFile(existingBranch.imageUrl);
      }
    }

    const updatedBranch = await prisma.branch.update({
      where: { id: branchId },
      data: updateData,
    });
    
    // Clear relevant cache
    await deleteCachedDataByPattern('branches');
    await deleteCachedDataByPattern('admin_branches');
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_BRANCH',
        details: `Mengupdate cabang "${existingBranch.name}" menjadi "${updateData.name}"`,
        ipAddress: req.ip || undefined
      }
    });
    
    res.status(200).json({
      status: true,
      message: 'Berhasil mengupdate cabang',
      data: updatedBranch
    });
  } catch (error) {
    console.error('Error updating branch:', error);
    // Clean up uploaded file if exists
    if (req.file?.path) {
      await cleanupUploadedFile(req.file.path);
    }
    res.status(500).json({ 
      status: false,
      message: 'Internal Server Error'
    });
  }
};
