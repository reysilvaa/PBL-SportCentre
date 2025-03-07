// src/services/notification.service.ts
import prisma from '../config/database';
import { getIO } from '../config/socket';

export enum NotificationType {
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  BOOKING_REMINDER = 'booking_reminder',
  PAYMENT_DP = 'payment_dp',
}

interface NotificationData {
  userId: number;
  title: string;
  message: string;
  type: string;
  linkId?: string;
}

export async function createNotification(data: NotificationData) {
  try {
    const { userId, title, message, type, linkId } = data;
    
    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        linkId,
        isRead: false,
      }
    });
    
    // Emit notification via socket
    const io = getIO();
    io.to(`user-${userId}`).emit('notification', notification);
    
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: number) {
  try {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

export async function getUserNotifications(userId: number) {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    console.error('Failed to get user notifications:', error);
    throw error;
  }
}