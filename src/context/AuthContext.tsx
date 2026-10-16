import React, { createContext, useContext, useState, useEffect } from 'react';
import { localBackend, type UserProfile } from '@/services/firebase/localProvider';
import {
  registerUser,
  loginUser,
  logoutUser,
  changeUsername,
  subscribeToAuthState,
  setUserOnlineStatus,
  getInitialAuthState,
  getCachedAuthProfile,
  reloadUserProfile,
  deleteUserAccount,
} from '@/services/firebase/authService';
import { startPresenceTracking, syncPresenceHeartbeat } from '@/services/firebase/presenceService';
import { LOCAL_CONFIG } from '@/services/firebase/localConfig';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  refreshUser: (updatedProfile?: UserProfile | null) => Promise<UserProfile | null>;
  setUserStatus: (status: 'online' | 'in-game' | 'offline') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initial] = useState(() => getInitialAuthState());
  const [user, setUser] = useState<UserProfile | null>(initial.initialUser);
  const [isLoading, setIsLoading] = useState(initial.initialLoading);

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

  // Synchronize user profile updates reactively across components and tabs
  useEffect(() => {
    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<UserProfile>;
      if (customEvent.detail) {
        setUser((current) => {
          if (!current) return customEvent.detail;
          return {
            ...customEvent.detail,
            status: current.status,
          };
        });
      } else {
        reloadUserProfile().then((p) => {
          if (p) setUser(p);
        });
      }
    };

    window.addEventListener(LOCAL_CONFIG.events.profileUpdated, handleProfileUpdate);
    return () => {
      window.removeEventListener(LOCAL_CONFIG.events.profileUpdated, handleProfileUpdate);
    };
  }, []);

  // Synchronize user status reactively when activity changes or multi-tab presence changes
  useEffect(() => {
    const handleStatusSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId?: string; status?: 'online' | 'in-game' | 'offline' }>;
      const newStatus = customEvent?.detail?.status;
      const targetUserId = customEvent?.detail?.userId;

      if (newStatus) {
        setUser((current) => {
          if (!current) return null;
          if (targetUserId && current.id !== targetUserId) return current;
          if (current.status === newStatus) return current;
          return { ...current, status: newStatus };
        });
        return;
      }

      // Storage event or generic synchronization across browser tabs
      const cached = getCachedAuthProfile() || localBackend.getCurrentUser();
      if (cached) {
        setUser((current) => {
          if (!current || current.id !== cached.id) return current;
          if (current.status === cached.status) return current;
          return { ...current, status: cached.status };
        });
      }
    };

    window.addEventListener(LOCAL_CONFIG.events.userStatusChanged, handleStatusSync);
    window.addEventListener('storage', handleStatusSync);
    return () => {
      window.removeEventListener(LOCAL_CONFIG.events.userStatusChanged, handleStatusSync);
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

  const deleteAccount = React.useCallback(async (password: string) => {
    await deleteUserAccount(password);
    setUser(null);
  }, []);

  const setUserStatus = React.useCallback(async (status: 'online' | 'in-game' | 'offline') => {
    await setUserOnlineStatus(status);
    setUser((current) => (current ? { ...current, status } : null));
    syncPresenceHeartbeat();
  }, []);

  const refreshUser = React.useCallback(async (updatedProfile?: UserProfile | null) => {
    if (updatedProfile) {
      setUser((current) => {
        if (!current) return updatedProfile;
        return {
          ...updatedProfile,
          status: current.status,
        };
      });
      return updatedProfile;
    }
    const fresh = await reloadUserProfile();
    if (fresh) {
      setUser(fresh);
      return fresh;
    }
    return null;
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      logout,
      updateUsername,
      deleteAccount,
      refreshUser,
      setUserStatus,
    }),
    [user, isLoading, login, register, logout, updateUsername, deleteAccount, refreshUser, setUserStatus]
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
