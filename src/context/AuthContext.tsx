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

  const login = async (email: string, pass: string) => {
    const profile = await loginUser(email, pass);
    setUser(profile);
  };

  const register = async (email: string, pass: string, username: string) => {
    const profile = await registerUser(email, pass, username);
    setUser(profile);
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  const updateUsername = async (newUsername: string) => {
    if (!user) throw new Error('Not logged in');
    const updated = await changeUsername(user.id, newUsername);
    setUser(updated);
  };

  const refreshUser = () => {
    subscribeToAuthState((profile) => setUser(profile));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        updateUsername,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
