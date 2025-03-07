import { Namespace } from 'socket.io';
import prisma from '../../config/database';

export function setupNotificationHandlers(namespace: Namespace) {
  namespace.on('connection', (socket) => {
    console.log(`User connected to notifications namespace: ${socket.data.user.id}`);

    // Join a room specific to the user for targeted updates
    const userId = socket.data.user.id;
    socket.join(`user-${userId}`);

    // Get user's unread notifications
    socket.on('get-notifications', async (data, callback) => {
      try {
        const { page = 1, limit = 10 } = data;
        const skip = (page - 1) * limit;
        
        const notifications = await prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip
        });
        
        const totalCount = await prisma.notification.count({
          where: { userId }
        });
        
        callback({ 
          status: 'success', 
          data: { 
            notifications,
            pagination: {
              page,
              limit,
              totalCount,
              totalPages: Math.ceil(totalCount / limit)
            }
          } 
        });
      } catch (error) {
        console.error('Get notifications error:', error);
        callback({ 
          status: 'error', 
          message: 'Failed to get notifications' 
        });
      }
    });

    // Mark notification as read
    socket.on('mark-notification-read', async (data, callback) => {
      try {
        const { notificationId } = data;
        
        const notification = await prisma.notification.findUnique({
          where: { id: Number(notificationId) }
        });
        
        if (!notification) {
          return callback({ 
            status: 'error', 
            message: 'Notification not found' 
          });
        }
        
        if (notification.userId !== userId) {
          return callback({ 
            status: 'error', 
            message: 'Not authorized to access this notification' 
          });
        }
        
        const updatedNotification = await prisma.notification.update({
          where: { id: Number(notificationId) },
          data: { isRead: true }
        });
        
        callback({ 
          status: 'success', 
          data: { notification: updatedNotification } 
        });
      } catch (error) {
        console.error('Mark notification read error:', error);
        callback({ 
          status: 'error', 
          message: 'Failed to mark notification as read' 
        });
      }
    });

    // Mark all notifications as read
    socket.on('mark-all-notifications-read', async (callback) => {
      try {
        await prisma.notification.updateMany({
          where: { 
            userId,
            isRead: false
          },
          data: { isRead: true }
        });
        
        callback({ 
          status: 'success', 
          message: 'All notifications marked as read' 
        });
      } catch (error) {
        console.error('Mark all notifications read error:', error);
        callback({ 
          status: 'error', 
          message: 'Failed to mark all notifications as read' 
        });
      }
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected from notifications namespace: ${socket.data.user.id}`);
    });
  });
}