import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '@/services/firebase/mockProvider';
import {
  registerUser,
  loginUser,
  logoutUser,
  changeUsername,
  subscribeToAuthState,
  setUserOnlineStatus,
} from '@/services/firebase/authService';
import { startPresenceTracking, syncPresenceHeartbeat } from '@/services/firebase/presenceService';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
  refreshUser: () => void;
  setUserStatus: (status: 'online' | 'in-game' | 'offline') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize persistent app-level presence and activity tracking
  useEffect(() => {
    const stopPresence = startPresenceTracking();
    return () => stopPresence();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((profile) => {
      setUser(profile);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Synchronize user status reactively when activity changes or multi-tab presence changes
  useEffect(() => {
    const handleStatusSync = () => {
      setUser((current) => {
        if (!current) return null;
        // In local mock mode, get latest computed profile with active status
        subscribeToAuthState((latest) => {
          if (latest) setUser(latest);
        });
        return current;
      });
    };

    window.addEventListener('schada_user_status_changed', handleStatusSync);
    window.addEventListener('storage', handleStatusSync);
    return () => {
      window.removeEventListener('schada_user_status_changed', handleStatusSync);
      window.removeEventListener('storage', handleStatusSync);
    };
  }, []);

  const login = React.useCallback(async (email: string, pass: string) => {
    const profile = await loginUser(email, pass);
    setUser(profile);
  }, []);

  const register = React.useCallback(async (email: string, pass: string, username: string) => {
    const profile = await registerUser(email, pass, username);
    setUser(profile);
  }, []);

  const logout = React.useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const updateUsername = React.useCallback(async (newUsername: string) => {
    setUser((currentUser) => {
      if (!currentUser) throw new Error('Not logged in');
      changeUsername(currentUser.id, newUsername).then((updated) => setUser(updated));
      return currentUser;
    });
  }, []);

  const setUserStatus = React.useCallback(async (status: 'online' | 'in-game' | 'offline') => {
    await setUserOnlineStatus(status);
    setUser((current) => (current ? { ...current, status } : null));
    syncPresenceHeartbeat();
  }, []);

  const refreshUser = React.useCallback(() => {
    subscribeToAuthState((profile) => setUser(profile));
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      logout,
      updateUsername,
      refreshUser,
      setUserStatus,
    }),
    [user, isLoading, login, register, logout, updateUsername, refreshUser, setUserStatus]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
