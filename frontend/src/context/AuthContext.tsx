import { type ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredToken, UNAUTHORIZED_EVENT } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

export function isProfileComplete(user: any): boolean {
  if (!user) return false;
  const hasName = !!(user.name && user.name.trim());
  const hasDept = !!(user.department && user.department.trim());
  const hasPhone = !!(user.phone && user.phone.trim());
  const hasUniId = !!(user.universityId && user.universityId.trim());
  const hasSemester = !!user.semester;
  return hasName && hasDept && hasPhone && (user.role === 'student' ? (hasUniId && hasSemester) : true);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }
      
      try {
        const response = await api<{ success: boolean; data: User }>('GET', '/auth/me');
        if (response.success && response.data) {
          setToken(storedToken);
          setUser(response.data);
        } else {
          localStorage.removeItem('cnp_auth_token');
        }
      } catch (error) {
        localStorage.removeItem('cnp_auth_token');
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  /* The API client clears the token on a 401 and fires this. One listener here
     turns an expired session into a clean sign-out instead of a dead shell. */
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      setLoading(false);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('cnp_auth_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    try {
      api('POST', '/auth/logout').catch(() => {});
    } catch {}
    localStorage.removeItem('cnp_auth_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
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
