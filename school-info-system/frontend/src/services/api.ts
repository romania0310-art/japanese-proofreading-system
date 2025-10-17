import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { 
  ApiResponse, 
  PaginatedResponse, 
  LoginCredentials, 
  AuthTokens, 
  User, 
  Message, 
  MessageFormData,
  MessageStats,
  UserStats,
  AudioFile,
  TranscriptionResult
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class ApiService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load tokens from localStorage
    this.loadTokens();

    // Setup request interceptor
    this.api.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Setup response interceptor for token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry && this.refreshToken) {
          originalRequest._retry = true;
          
          try {
            const newToken = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            this.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private loadTokens(): void {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  private saveTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: this.refreshToken,
    });

    const { accessToken } = response.data;
    this.accessToken = accessToken;
    localStorage.setItem('accessToken', accessToken);
    return accessToken;
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const response: AxiosResponse<ApiResponse<{ user: User; tokens: AuthTokens }>> = 
      await this.api.post('/auth/login', credentials);
    
    if (response.data.success && response.data.data) {
      this.saveTokens(response.data.data.tokens);
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Login failed');
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout', { refreshToken: this.refreshToken });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User> {
    const response: AxiosResponse<ApiResponse<{ user: User }>> = 
      await this.api.get('/auth/me');
    
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    
    throw new Error(response.data.error?.message || 'Failed to get user info');
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response: AxiosResponse<ApiResponse<{ user: User }>> = 
      await this.api.put('/auth/profile', data);
    
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    
    throw new Error(response.data.error?.message || 'Failed to update profile');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response: AxiosResponse<ApiResponse> = 
      await this.api.post('/auth/change-password', { currentPassword, newPassword });
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to change password');
    }
  }

  // Message endpoints
  async getMessages(params?: {
    page?: number;
    limit?: number;
    confidentialityLevel?: number;
    isUrgent?: boolean;
    startDate?: string;
    endDate?: string;
    senderId?: number;
  }): Promise<PaginatedResponse<Message>> {
    const response: AxiosResponse<PaginatedResponse<Message>> = 
      await this.api.get('/api/messages', { params });
    
    return response.data;
  }

  async getSentMessages(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Message>> {
    const response: AxiosResponse<PaginatedResponse<Message>> = 
      await this.api.get('/api/messages/sent', { params });
    
    return response.data;
  }

  async getMessage(id: number): Promise<Message> {
    const response: AxiosResponse<ApiResponse<{ message: Message }>> = 
      await this.api.get(`/api/messages/${id}`);
    
    if (response.data.success && response.data.data) {
      return response.data.data.message;
    }
    
    throw new Error(response.data.error?.message || 'Failed to get message');
  }

  async sendMessage(messageData: MessageFormData): Promise<Message> {
    const response: AxiosResponse<ApiResponse<Message>> = 
      await this.api.post('/api/messages', messageData);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Failed to send message');
  }

  async markMessageRead(messageId: number): Promise<void> {
    const response: AxiosResponse<ApiResponse> = 
      await this.api.post(`/api/messages/${messageId}/read`);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to mark message as read');
    }
  }

  async deleteMessage(messageId: number): Promise<void> {
    const response: AxiosResponse<ApiResponse> = 
      await this.api.delete(`/api/messages/${messageId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to delete message');
    }
  }

  async getMessageStats(): Promise<MessageStats> {
    const response: AxiosResponse<ApiResponse<{ stats: MessageStats }>> = 
      await this.api.get('/api/messages/stats/summary');
    
    if (response.data.success && response.data.data) {
      return response.data.data.stats;
    }
    
    throw new Error(response.data.error?.message || 'Failed to get message stats');
  }

  // User management endpoints
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    department?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<PaginatedResponse<User>> {
    const response: AxiosResponse<PaginatedResponse<User>> = 
      await this.api.get('/api/users', { params });
    
    return response.data;
  }

  async getUser(id: number): Promise<User> {
    const response: AxiosResponse<ApiResponse<{ user: User }>> = 
      await this.api.get(`/api/users/${id}`);
    
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    
    throw new Error(response.data.error?.message || 'Failed to get user');
  }

  async createUser(userData: Partial<User> & { password: string }): Promise<User> {
    const response: AxiosResponse<ApiResponse<{ user: User }>> = 
      await this.api.post('/api/users', userData);
    
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    
    throw new Error(response.data.error?.message || 'Failed to create user');
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const response: AxiosResponse<ApiResponse<{ user: User }>> = 
      await this.api.put(`/api/users/${id}`, userData);
    
    if (response.data.success && response.data.data) {
      return response.data.data.user;
    }
    
    throw new Error(response.data.error?.message || 'Failed to update user');
  }

  async deleteUser(id: number): Promise<void> {
    const response: AxiosResponse<ApiResponse> = 
      await this.api.delete(`/api/users/${id}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to delete user');
    }
  }

  async getRecipients(params?: { role?: string; department?: string }): Promise<User[]> {
    const response: AxiosResponse<ApiResponse<{ recipients: User[] }>> = 
      await this.api.get('/api/users/recipients', { params });
    
    if (response.data.success && response.data.data) {
      return response.data.data.recipients;
    }
    
    throw new Error(response.data.error?.message || 'Failed to get recipients');
  }

  async getDepartments(): Promise<string[]> {
    const response: AxiosResponse<ApiResponse<{ departments: string[] }>> = 
      await this.api.get('/api/users/departments');
    
    if (response.data.success && response.data.data) {
      return response.data.data.departments;
    }
    
    throw new Error(response.data.error?.message || 'Failed to get departments');
  }

  async getUserStats(): Promise<UserStats> {
    const response: AxiosResponse<ApiResponse<{ stats: UserStats }>> = 
      await this.api.get('/api/users/stats/overview');
    
    if (response.data.success && response.data.data) {
      return response.data.data.stats;
    }
    
    throw new Error(response.data.error?.message || 'Failed to get user stats');
  }

  async resetUserPassword(id: number, newPassword: string): Promise<void> {
    const response: AxiosResponse<ApiResponse> = 
      await this.api.post(`/api/users/${id}/reset-password`, { newPassword });
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to reset password');
    }
  }

  // Speech/Audio endpoints
  async uploadAudio(file: File, metadata?: any): Promise<AudioFile> {
    const formData = new FormData();
    formData.append('audio', file);
    
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });
    }

    const response: AxiosResponse<ApiResponse<{ file: AudioFile }>> = 
      await this.api.post('/api/speech/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    
    if (response.data.success && response.data.data) {
      return response.data.data.file;
    }
    
    throw new Error(response.data.error?.message || 'Failed to upload audio');
  }

  async transcribeAudio(audioUrl: string, options?: any): Promise<TranscriptionResult> {
    const response: AxiosResponse<ApiResponse<{ transcription: TranscriptionResult }>> = 
      await this.api.post('/api/speech/transcribe', { audioUrl, options });
    
    if (response.data.success && response.data.data) {
      return response.data.data.transcription;
    }
    
    throw new Error(response.data.error?.message || 'Failed to transcribe audio');
  }

  async getSpeechSettings(): Promise<any> {
    const response: AxiosResponse<ApiResponse<{ settings: any }>> = 
      await this.api.get('/api/speech/settings');
    
    if (response.data.success && response.data.data) {
      return response.data.data.settings;
    }
    
    throw new Error(response.data.error?.message || 'Failed to get speech settings');
  }

  async deleteAudioFile(fileId: string): Promise<void> {
    const response: AxiosResponse<ApiResponse> = 
      await this.api.delete(`/api/speech/files/${fileId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to delete audio file');
    }
  }

  // Utility methods
  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

export const apiService = new ApiService();
export default apiService;