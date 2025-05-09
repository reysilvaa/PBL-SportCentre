import prisma from '../../config/services/database';
import { broadcastActivityLogUpdates } from '../../socket-handlers/activityLog.socket';
import { User, ActivityLog } from '../../types';

/**
 * Service to handle activity log operations with real-time updates
 */
export class ActivityLogService {
  /**
   * Creates a new activity log and broadcasts the update to all clients
   * @param userId - The ID of the user performing the action
   * @param action - Description of the action performed
   * @param details - Optional details about the action (as JSON string or object)
   * @param relatedId - Optional ID of related entity (booking, field, etc.)
   * @param ipAddress - Optional IP address of the user
   */
  static async createLog(
    userId: number,
    action: string,
    details?: string | object,
    relatedId?: number,
    ipAddress?: string,
  ): Promise<ActivityLog> {
    try {
      // Convert object to string if details is provided as an object
      const detailsStr = details
        ? typeof details === 'string'
          ? details
          : JSON.stringify(details)
        : undefined;

      // Create the log in the database
      const newLog = await prisma.activityLog.create({
        data: {
          userId,
          action,
          details: detailsStr,
          ...(relatedId && { relatedId }),
          ...(ipAddress && { ipAddress }),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      console.log(`Activity log created for user ${userId}: ${action}`);

      // Emit updates to specific rooms and all clients
      await broadcastActivityLogUpdates(userId);

      return newLog as ActivityLog;
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw error;
    }
  }

  /**
   * Creates a new booking-related activity log
   * @param user - User object or user ID
   * @param action - Description of the action
   * @param bookingId - ID of the booking
   * @param details - Optional details about the booking action
   * @param ipAddress - Optional IP address of the user
   */
  static async logBookingActivity(
    user: User | number,
    action: string,
    bookingId: number,
    details?: object,
    ipAddress?: string,
  ): Promise<any> {
    const userId = typeof user === 'number' ? user : user.id;
    return this.createLog(userId, action, details, bookingId, ipAddress);
  }

  /**
   * Creates a new payment-related activity log
   * @param userId - User ID
   * @param paymentId - Payment ID
   * @param bookingId - Booking ID
   * @param status - Payment status
   * @param details - Additional payment details
   * @param ipAddress - Optional IP address of the user
   */
  static async logPaymentActivity(
    userId: number,
    paymentId: number,
    bookingId: number,
    status: string,
    details?: object,
    ipAddress?: string,
  ): Promise<any> {
    const action = `Payment ${status} for booking ${bookingId}`;
    return this.createLog(
      userId,
      action,
      {
        paymentId,
        bookingId,
        status,
        ...details,
      },
      undefined,
      ipAddress,
    );
  }

  /**
   * Broadcast activity log updates to all connected clients and user-specific rooms
   * @param userId - Optional user ID to filter logs for specific rooms
   */
  static async broadcastActivityLogUpdates(userId?: number): Promise<void> {
    await broadcastActivityLogUpdates(userId);
  }

  /**
   * Retrieve activity logs with optional user filtering
   * @param userId - Optional user ID to filter logs
   * @returns Array of activity logs with user information
   */
  static async getLogs(userId?: number): Promise<any[]> {
    return prisma.activityLog.findMany({
      where: userId ? { userId } : {},
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Delete an activity log by ID
   * @param id - Activity log ID
   * @returns The deleted activity log
   */
  static async deleteLog(id: number): Promise<any> {
    const deletedLog = await prisma.activityLog.delete({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Broadcast updates after deletion
    await this.broadcastActivityLogUpdates();

    return deletedLog;
  }
}
