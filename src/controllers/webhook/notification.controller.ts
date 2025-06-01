// src/controllers/notification.controller.ts (simplified version)
import { Request, Response } from 'express';
import prisma from '../../config/services/database';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const notifications = await prisma.notification.findMany({
      where: {
        userId: parseInt(userId),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      status: true,
      message: 'Berhasil mendapatkan notifikasi',
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      status: false,
      message: 'Gagal mendapatkan notifikasi',
      error: 'Internal Server Error' 
    });
  }
};

export const readNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true },
    });

    res.json({
      status: true,
      message: 'Notifikasi ditandai sebagai telah dibaca',
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      status: false,
      message: 'Gagal menandai notifikasi sebagai dibaca',
      error: 'Internal Server Error' 
    });
  }
};
