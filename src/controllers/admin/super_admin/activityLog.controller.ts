import { Request, Response } from 'express';
import { validate } from 'class-validator';
import { CreateActivityLogDto } from '../../../dto/activityLog/create-activity-log.dto';
import { ActivityLogService } from '../../../utils/activityLog.utils';
import { getIO } from '../../../config/socket';

export const getActivityLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const logs = await ActivityLogService.getLogs(userId);
    
    // Force realtime update to all admins when API is called
    if (req.query.realtime === 'true') {
      await ActivityLogService.broadcastActivityLogUpdates();
    }
    
    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};
/**
 * Set up a Socket.IO connection for real-time activity log updates
 * @param userId - Optional user ID to filter logs
 */
const setupRealtimeConnection = (userId?: number) => {
  const io = getIO();
  
  // Create a room name based on userId if provided, otherwise use a general room
  const roomName = userId ? `activity_logs_user_${userId}` : 'activity_logs_all';
  
  // Set up a listener for client connections
  io.on('connection', (socket) => {
    console.log(`Client connected to activity logs: ${socket.id}`);
    
    // Join the appropriate room
    socket.join(roomName);
    
    // Set up listener for when client wants to subscribe to activity logs
    socket.on('subscribe_activity_logs', async (options: { userId?: string }) => {
      // If the client specifies a userId, join that specific room
      if (options.userId) {
        const userIdInt = parseInt(options.userId);
        const userRoom = `activity_logs_user_${userIdInt}`;
        socket.join(userRoom);
        console.log(`Client ${socket.id} joined ${userRoom}`);
        
        // Send initial data to the client
        const userLogs = await ActivityLogService.getLogs(userIdInt);
        socket.emit('activity_logs_initial', userLogs);
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected from activity logs: ${socket.id}`);
    });
  });
};

export const createActivityLog = async (req: Request, res: Response): Promise<void> => { 
  try {
    const dto = new CreateActivityLogDto();
    Object.assign(dto, req.body);
    
    const errors = await validate(dto);
    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    const newLog = await ActivityLogService.createLog(
      dto.userId,
      dto.action,
      dto.details,
      dto.relatedId
    );
    
    res.status(201).json(newLog); 
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create activity log' });
  }
};

export const deleteActivityLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const idInt = parseInt(id);
    
    const deletedLog = await ActivityLogService.deleteLog(idInt);
    
    res.status(200).json({
      message: 'Successfully deleted',
      data: deletedLog
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete activity log' });
  }
};