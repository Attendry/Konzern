import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { authService, User, LoginCredentials, RegisterCredentials } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          const userData = await authService.getMe();
          setUser(userData);
        }
      } catch (error) {
        console.log('No valid session found');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    setUser(response.user);
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    await authService.register(credentials);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authService.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    const updatedUser = await authService.updateProfile(updates);
    setUser(prev => prev ? { ...prev, ...updatedUser } : null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes (optional)
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredRoles?: string[],
) {
  return function WithAuthComponent(props: P) {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
      return (
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Lade...</span>
        </div>
      );
    }

    if (!isAuthenticated) {
      // Redirect to login or show unauthorized message
      return (
        <div className="card">
          <div className="card-header">
            <h2>Nicht angemeldet</h2>
          </div>
          <p>Bitte melden Sie sich an, um auf diese Seite zuzugreifen.</p>
        </div>
      );
    }

    if (requiredRoles && user && !requiredRoles.includes(user.role || '')) {
      return (
        <div className="card">
          <div className="card-header">
            <h2>Keine Berechtigung</h2>
          </div>
          <p>Sie haben keine Berechtigung, auf diese Seite zuzugreifen.</p>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}
