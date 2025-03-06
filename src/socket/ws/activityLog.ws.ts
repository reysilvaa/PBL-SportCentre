import { Server, Socket } from 'socket.io';
import prisma from '../../config/database';
import { CreateActivityLogDto } from '../../dto/activityLog/create-activity-log.dto';
import { validate } from 'class-validator';

export const initActivityLogSocket = (io: Server) => {
  const activityNamespace = io.of('/activity');

  activityNamespace.on('connection', (socket: Socket) => {
    console.log('Client connected to activity log namespace');

    socket.on('createActivityLog', async (data: CreateActivityLogDto) => {
      try {
        const dto = new CreateActivityLogDto();
        Object.assign(dto, data);

        const errors = await validate(dto);
        if (errors.length > 0) {
          return socket.emit('error', {
            type: 'validation',
            error: 'Validation failed',
            details: errors
          });
        }

        const newLog = await prisma.activityLog.create({
          data: { userId: dto.userId, action: dto.action },
          include: { user: { select: { id: true, name: true, email: true } } }
        });

        activityNamespace.emit('newLog', newLog);
        socket.emit('created', newLog);
      } catch (error) {
        socket.emit('error', {
          type: 'creation',
          error: 'Failed to create activity log',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });

    socket.on('getLogs', async (filters: { userId?: number }) => {
      try {
        const logs = await prisma.activityLog.findMany({
          where: filters.userId ? { userId: filters.userId } : {},
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50
        });

        socket.emit('logsList', logs);
      } catch (error) {
        socket.emit('error', {
          type: 'retrieval',
          error: 'Failed to retrieve activity logs',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });

    socket.on('deleteLog', async (logId: number) => {
      try {
        await prisma.activityLog.delete({
          where: { id: logId }
        });

        activityNamespace.emit('logDeleted', logId);
        socket.emit('deleteConfirmed', logId);
      } catch (error) {
        socket.emit('error', {
          type: 'deletion',
          error: 'Failed to delete activity log',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected from activity log namespace');
    });
  });
};
