import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  role?: 'admin' | 'auditor' | 'preparer' | 'viewer';
  department?: string;
  phone?: string;
  avatarUrl?: string;
  preferences?: Record<string, any>;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  displayName?: string;
}

export interface LoginResponse {
  success: boolean;
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Create axios instance with interceptors
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export const authService = {
  /**
   * Register new user
   */
  async register(credentials: RegisterCredentials): Promise<User> {
    const response = await api.post('/auth/register', credentials);
    return response.data.user;
  },

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  /**
   * Get current user
   */
  async getMe(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data.user;
  },

  /**
   * Update current user profile
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await api.put('/auth/me', updates);
    return response.data.profile;
  },

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    const response = await api.get('/auth/users');
    return response.data.users;
  },

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, role: User['role']): Promise<User> {
    const response = await api.put(`/auth/users/${userId}/role`, { role });
    return response.data.profile;
  },

  /**
   * Refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    return response.data;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },

  /**
   * Get current token
   */
  getToken(): string | null {
    return localStorage.getItem('accessToken');
  },
};

export default authService;
