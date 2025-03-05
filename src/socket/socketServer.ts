import { Server, Socket } from 'socket.io';
import prisma from '../config/database';
import { CreateActivityLogDto } from '../dto/activityLog/create-activity-log.dto';
import { validate } from 'class-validator';

export const initSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    // Create Activity Log
    socket.on('createActivityLog', async (data: CreateActivityLogDto) => {
      try {
        const dto = new CreateActivityLogDto();
        Object.assign(dto, data);
        
        const errors = await validate(dto);
        if (errors.length > 0) {
          return socket.emit('activityLogError', { 
            error: 'Validation failed', 
            details: errors 
          });
        }

        const newLog = await prisma.activityLog.create({
          data: { userId: dto.userId, action: dto.action },
          include: { user: { select: { id: true, name: true, email: true } } }
        });

        io.emit('newActivityLog', newLog);
        socket.emit('activityLogCreated', newLog);
      } catch (error) {
        socket.emit('activityLogError', { 
          error: 'Failed to create activity log',
          details: error instanceof Error ? error.message : error
        });
      }
    });

    // Get Activity Logs
    socket.on('getActivityLogs', async (filters: { userId?: number }) => {
      try {
        const logs = await prisma.activityLog.findMany({
          where: filters.userId ? { userId: filters.userId } : {},
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50
        });

        socket.emit('activityLogsReceived', logs);
      } catch (error) {
        socket.emit('activityLogsError', { 
          error: 'Failed to retrieve activity logs',
          details: error instanceof Error ? error.message : error
        });
      }
    });

    // Delete Activity Log
    socket.on('deleteActivityLog', async (logId: number) => {
      try {
        const deletedLog = await prisma.activityLog.delete({
          where: { id: logId }
        });

        io.emit('activityLogDeleted', logId);
        socket.emit('activityLogDeleteConfirmed', deletedLog);
      } catch (error) {
        socket.emit('activityLogError', { 
          error: 'Failed to delete activity log',
          details: error instanceof Error ? error.message : error
        });
      }
    });
  });
};