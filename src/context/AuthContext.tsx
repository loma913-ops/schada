import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '@/services/firebase/mockProvider';
import {
  registerUser,
  loginUser,
  logoutUser,
  changeUsername,
  subscribeToAuthState,
} from '@/services/firebase/authService';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((profile) => {
      setUser(profile);
      setIsLoading(false);
    });
    return () => unsubscribe();
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
    }),
    [user, isLoading, login, register, logout, updateUsername, refreshUser]
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
