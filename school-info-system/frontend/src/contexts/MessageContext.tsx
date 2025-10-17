import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { apiService } from '../services/api';
import { Message, SocketMessage, MessageStats } from '../types';

interface MessageContextType {
  messages: Message[];
  stats: MessageStats | null;
  loading: boolean;
  error: string | null;
  refreshMessages: () => Promise<void>;
  refreshStats: () => Promise<void>;
  markAsRead: (messageId: number) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  // Real-time message handling
  addNewMessage: (message: Message) => void;
  updateMessageReadStatus: (messageId: number, isRead: boolean) => void;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

interface MessageProviderProps {
  children: ReactNode;
}

export const MessageProvider: React.FC<MessageProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    onNewMessage, 
    onMessageRead,
    markMessageRead,
  } = useSocket();

  useEffect(() => {
    // Initialize data
    refreshMessages();
    refreshStats();

    // Setup real-time event listeners
    onNewMessage(handleNewMessage);
    onMessageRead(handleMessageRead);
  }, []);

  const handleNewMessage = (socketMessage: SocketMessage) => {
    console.log('New message received:', socketMessage);
    
    // Convert socket message to Message format
    const newMessage: Message = {
      id: Date.now(), // Temporary ID - should be replaced by API response
      content: socketMessage.content,
      confidentialityLevel: socketMessage.confidentialityLevel as 1 | 2 | 3,
      isUrgent: socketMessage.isUrgent,
      createdAt: socketMessage.timestamp,
      updatedAt: socketMessage.timestamp,
      sender: {
        id: socketMessage.senderId,
        username: socketMessage.senderName,
        email: '',
        role: 'USER',
        isActive: true,
        createdAt: '',
      },
      recipients: [],
      isRead: false,
    };

    addNewMessage(newMessage);
    
    // Refresh stats to update unread count
    refreshStats();
  };

  const handleMessageRead = (data: { messageId: string; readBy: number; readByName: string; readAt: string }) => {
    const messageId = parseInt(data.messageId);
    updateMessageReadStatus(messageId, true);
    
    // Refresh stats
    refreshStats();
  };

  const refreshMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getMessages({ limit: 50 });
      setMessages(response.data || []);
    } catch (error: any) {
      console.error('Failed to refresh messages:', error);
      setError(error.message || 'メッセージの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async () => {
    try {
      const statsData = await apiService.getMessageStats();
      setStats(statsData);
    } catch (error: any) {
      console.error('Failed to refresh stats:', error);
    }
  };

  const markAsRead = async (messageId: number) => {
    try {
      await apiService.markMessageRead(messageId);
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isRead: true, readAt: new Date().toISOString() }
          : msg
      ));

      // Send real-time notification
      markMessageRead(messageId);
      
      // Refresh stats
      refreshStats();
    } catch (error: any) {
      console.error('Failed to mark message as read:', error);
      throw error;
    }
  };

  const deleteMessage = async (messageId: number) => {
    try {
      await apiService.deleteMessage(messageId);
      
      // Remove from local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Refresh stats
      refreshStats();
    } catch (error: any) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  };

  const addNewMessage = (message: Message) => {
    setMessages(prev => {
      // Check if message already exists (avoid duplicates)
      const exists = prev.some(msg => msg.id === message.id);
      if (exists) return prev;
      
      // Add new message at the beginning
      return [message, ...prev];
    });
  };

  const updateMessageReadStatus = (messageId: number, isRead: boolean) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isRead, readAt: isRead ? new Date().toISOString() : undefined }
        : msg
    ));
  };

  const value: MessageContextType = {
    messages,
    stats,
    loading,
    error,
    refreshMessages,
    refreshStats,
    markAsRead,
    deleteMessage,
    addNewMessage,
    updateMessageReadStatus,
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
};