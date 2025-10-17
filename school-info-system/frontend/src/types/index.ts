// User types
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'USER';
  department?: string;
  fullName?: string;
  phone?: string;
  isActive: boolean;
  twoFactorEnabled?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
}

// Message types
export interface Message {
  id: number;
  content: string;
  confidentialityLevel: 1 | 2 | 3;
  isUrgent: boolean;
  audioDuration?: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  sender: User;
  recipients: User[];
  isRead?: boolean;
  readAt?: string;
  reads?: MessageRead[];
  metadata?: any;
  decryptionError?: boolean;
}

export interface MessageRead {
  id: number;
  messageId: number;
  userId: number;
  readAt: string;
  user?: User;
}

export interface MessageRecipient {
  id: number;
  messageId: number;
  recipientId: number;
  recipientType: 'USER' | 'GROUP';
  recipient: User;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Authentication types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser extends User {
  tokens?: AuthTokens;
}

// Speech/Voice types
export interface VoiceRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: string;
}

export interface AudioFile {
  id: string;
  filename: string;
  size: number;
  duration?: number;
  url: string;
  uploadedAt: string;
  expiresAt: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration?: number;
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
  metadata?: {
    audioUrl: string;
    processedAt: string;
    processingTime: number;
    service: string;
  };
}

// Socket events
export interface SocketMessage {
  senderId: number;
  senderName: string;
  content: string;
  confidentialityLevel: number;
  isUrgent: boolean;
  timestamp: string;
  recipientIds: number[];
}

export interface TypingIndicator {
  userId: number;
  username: string;
  isTyping: boolean;
}

export interface VoiceRecordingIndicator {
  userId: number;
  username: string;
  isRecording: boolean;
}

export interface PresenceUpdate {
  userId: number;
  username: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  customMessage?: string;
  lastSeen: string;
}

// Message form types
export interface MessageFormData {
  content: string;
  recipientIds: number[];
  confidentialityLevel: 1 | 2 | 3;
  isUrgent: boolean;
  audioDuration?: number;
  metadata?: any;
}

// Statistics types
export interface MessageStats {
  unreadCount: number;
  totalReceived: number;
  totalSent: number;
  urgentCount: number;
  confidentialCount: number;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: {
    admin: number;
    staff: number;
    user: number;
  };
  recentLogins: number;
  departmentDistribution: Array<{
    department: string;
    count: number;
  }>;
}

// Confidentiality levels
export const CONFIDENTIALITY_LEVELS = [
  { value: 1, label: '一般', description: '通常の業務連絡', color: '#4caf50' },
  { value: 2, label: '注意', description: '個人情報を含む内容', color: '#ff9800' },
  { value: 3, label: '機密', description: '高度な秘匿性が必要', color: '#f44336' },
] as const;

// User roles
export const USER_ROLES = [
  { value: 'USER', label: '一般職員', description: '基本的な機能のみ利用可能' },
  { value: 'STAFF', label: '教職員', description: '職員管理機能も利用可能' },
  { value: 'ADMIN', label: '管理者', description: 'システム全体の管理が可能' },
] as const;

// Error types
export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormErrors {
  [key: string]: string | undefined;
}

// Navigation types
export interface NavItem {
  title: string;
  path: string;
  icon?: React.ComponentType;
  requiredRoles?: Array<'ADMIN' | 'STAFF' | 'USER'>;
  badge?: number;
}

// Theme types (for dark/light mode in the future)
export type ThemeMode = 'light' | 'dark';

// Notification types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

// Audio recording states
export type RecordingState = 'idle' | 'recording' | 'processing' | 'completed' | 'error';

// Speech recognition states
export type SpeechRecognitionState = 'idle' | 'listening' | 'processing' | 'completed' | 'error';