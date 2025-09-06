'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user;

  // Set up axios interceptors
  useEffect(() => {
    // Request interceptor to add auth header
    const requestInterceptor = api.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor to handle token refresh
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            const success = await refreshToken();
            if (success) {
              const token = localStorage.getItem('accessToken');
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api.request(originalRequest);
            }
          } catch (refreshError) {
            await logout();
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      console.log('🔐 Attempting login...', { email: credentials.email });
      
      const response = await api.post('/api/users/auth/login', credentials, {
        withCredentials: true, // Important for httpOnly cookies
      });

      console.log('✅ Login successful', response.data);
      
      const { user: userData, accessToken } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      setUser(userData);
      
      // Redirect to dashboard after successful login
      router.push('/');
    } catch (error: any) {
      console.error('❌ Login failed:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      
      const message = error.response?.data?.error || error.message || 'Login failed';
      throw new Error(message);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/api/users/auth/logout', {}, {
        withCredentials: true,
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
      router.push('/login');
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await api.post('/api/users/auth/refresh', {}, {
        withCredentials: true,
      });

      const { accessToken, user: userData } = response.data;
      localStorage.setItem('accessToken', accessToken);
      setUser(userData);
      return true;
    } catch (error) {
      localStorage.removeItem('accessToken');
      setUser(null);
      return false;
    }
  };

  // Check if user is authenticated on app start
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      
      if (token) {
        try {
          // Try to get current user profile
          const response = await api.get('/api/users/profile');
          setUser(response.data.user);
        } catch (error) {
          // Try to refresh token
          const refreshSuccess = await refreshToken();
          if (!refreshSuccess) {
            router.push('/login');
          }
        }
      } else {
        router.push('/login');
      }
      
      setIsLoading(false);
    };

    initAuth();
  }, [router]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
