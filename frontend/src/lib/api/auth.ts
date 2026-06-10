import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
  session_id?: string;
  user_agent?: string;
  device_label?: string;
}

export interface LoginResponse {
  result: string;
  message?: string;
  data?: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    session_id: string;
    user: {
      id: number;
      email: string;
      name: string;
      role: string;
      avatar?: string | null;
      quick_links?: string | null;
    };
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
}

export const authService = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/api/v1/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest) => {
    const response = await apiClient.post('/api/v1/auth/register', data);
    return response.data;
  },

  logout: async (sessionId: string) => {
    const response = await apiClient.post('/api/v1/auth/logout', {
      session_id: sessionId,
    });
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await apiClient.post('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },
};
