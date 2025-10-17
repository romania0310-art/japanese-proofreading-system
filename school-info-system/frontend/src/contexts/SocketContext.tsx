import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { 
  SocketMessage, 
  TypingIndicator, 
  VoiceRecordingIndicator, 
  PresenceUpdate,
  Message 
} from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Array<{
    userId: number;
    username: string;
    role: string;
    connectedAt: string;
  }>;
  sendMessage: (data: Omit<SocketMessage, 'senderId' | 'senderName' | 'timestamp'>) => void;
  markMessageRead: (messageId: number) => void;
  startTyping: (recipientIds: number[]) => void;
  stopTyping: (recipientIds: number[]) => void;
  startVoiceRecording: (recipientIds: number[]) => void;
  stopVoiceRecording: (recipientIds: number[]) => void;
  updatePresence: (status: 'online' | 'away' | 'busy', customMessage?: string) => void;
  subscribeToNotifications: () => void;
  // Event listeners
  onNewMessage: (callback: (message: SocketMessage) => void) => void;
  onMessageRead: (callback: (data: { messageId: string; readBy: number; readByName: string; readAt: string }) => void) => void;
  onTypingIndicator: (callback: (data: TypingIndicator) => void) => void;
  onVoiceRecordingIndicator: (callback: (data: VoiceRecordingIndicator) => void) => void;
  onPresenceUpdate: (callback: (data: PresenceUpdate) => void) => void;
  onUserOnline: (callback: (data: { userId: number; username: string }) => void) => void;
  onUserOffline: (callback: (data: { userId: number; username: string }) => void) => void;
  onUrgentNotification: (callback: (data: any) => void) => void;
  onSystemAnnouncement: (callback: (data: any) => void) => void;
  onError: (callback: (error: any) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Array<{
    userId: number;
    username: string;
    role: string;
    connectedAt: string;
  }>>([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      initializeSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, user]);

  const initializeSocket = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('user_online', (data) => {
      setOnlineUsers(prev => {
        const filtered = prev.filter(u => u.userId !== data.userId);
        return [...filtered, { 
          userId: data.userId, 
          username: data.username, 
          role: 'USER', // Default role, could be enhanced
          connectedAt: new Date().toISOString() 
        }];
      });
    });

    newSocket.on('user_offline', (data) => {
      setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
    });

    newSocket.on('force_disconnect', (data) => {
      console.log('Force disconnect:', data.reason);
      alert(`接続が管理者により切断されました: ${data.reason}`);
      disconnectSocket();
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
    }
  };

  // Socket methods
  const sendMessage = (data: Omit<SocketMessage, 'senderId' | 'senderName' | 'timestamp'>) => {
    if (socket && isConnected) {
      socket.emit('send_message', data);
    }
  };

  const markMessageRead = (messageId: number) => {
    if (socket && isConnected) {
      socket.emit('mark_read', { messageId });
    }
  };

  const startTyping = (recipientIds: number[]) => {
    if (socket && isConnected) {
      socket.emit('typing_start', { recipientIds });
    }
  };

  const stopTyping = (recipientIds: number[]) => {
    if (socket && isConnected) {
      socket.emit('typing_stop', { recipientIds });
    }
  };

  const startVoiceRecording = (recipientIds: number[]) => {
    if (socket && isConnected) {
      socket.emit('voice_recording_start', { recipientIds });
    }
  };

  const stopVoiceRecording = (recipientIds: number[]) => {
    if (socket && isConnected) {
      socket.emit('voice_recording_stop', { recipientIds });
    }
  };

  const updatePresence = (status: 'online' | 'away' | 'busy', customMessage?: string) => {
    if (socket && isConnected) {
      socket.emit('update_presence', { status, customMessage });
    }
  };

  const subscribeToNotifications = () => {
    if (socket && isConnected) {
      socket.emit('subscribe_notifications');
    }
  };

  // Event listener methods
  const onNewMessage = (callback: (message: SocketMessage) => void) => {
    if (socket) {
      socket.on('new_message', callback);
    }
  };

  const onMessageRead = (callback: (data: { messageId: string; readBy: number; readByName: string; readAt: string }) => void) => {
    if (socket) {
      socket.on('message_read', callback);
    }
  };

  const onTypingIndicator = (callback: (data: TypingIndicator) => void) => {
    if (socket) {
      socket.on('typing_indicator', callback);
    }
  };

  const onVoiceRecordingIndicator = (callback: (data: VoiceRecordingIndicator) => void) => {
    if (socket) {
      socket.on('voice_recording_indicator', callback);
    }
  };

  const onPresenceUpdate = (callback: (data: PresenceUpdate) => void) => {
    if (socket) {
      socket.on('presence_update', callback);
    }
  };

  const onUserOnline = (callback: (data: { userId: number; username: string }) => void) => {
    if (socket) {
      socket.on('user_online', callback);
    }
  };

  const onUserOffline = (callback: (data: { userId: number; username: string }) => void) => {
    if (socket) {
      socket.on('user_offline', callback);
    }
  };

  const onUrgentNotification = (callback: (data: any) => void) => {
    if (socket) {
      socket.on('urgent_notification', callback);
    }
  };

  const onSystemAnnouncement = (callback: (data: any) => void) => {
    if (socket) {
      socket.on('system_announcement', callback);
    }
  };

  const onError = (callback: (error: any) => void) => {
    if (socket) {
      socket.on('error', callback);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    onlineUsers,
    sendMessage,
    markMessageRead,
    startTyping,
    stopTyping,
    startVoiceRecording,
    stopVoiceRecording,
    updatePresence,
    subscribeToNotifications,
    onNewMessage,
    onMessageRead,
    onTypingIndicator,
    onVoiceRecordingIndicator,
    onPresenceUpdate,
    onUserOnline,
    onUserOffline,
    onUrgentNotification,
    onSystemAnnouncement,
    onError,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};