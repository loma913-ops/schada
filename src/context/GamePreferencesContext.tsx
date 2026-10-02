import React, { createContext, useContext, useState, useEffect } from 'react';
import { safeSetItem } from '@/services/storage/storageCleanup';
import { GAME_PREFERENCES_CONFIG } from '@/services/preferences/gamePreferencesConfig';

interface GamePreferencesContextType {
  showThreatIndicators: boolean;
  setShowThreatIndicators: (show: boolean) => void;
  toggleThreatIndicators: () => void;
}

const GamePreferencesContext = createContext<GamePreferencesContextType | undefined>(undefined);

export const GamePreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showThreatIndicators, setShowThreatIndicatorsState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(GAME_PREFERENCES_CONFIG.storageKeys.showThreatIndicators);
      if (stored === 'false') return false;
      if (stored === 'true') return true;
    } catch {
      // Fallback on restricted storage environments
    }
    return GAME_PREFERENCES_CONFIG.defaults.showThreatIndicators;
  });

  useEffect(() => {
    safeSetItem(
      GAME_PREFERENCES_CONFIG.storageKeys.showThreatIndicators,
      String(showThreatIndicators)
    );
  }, [showThreatIndicators]);

  const setShowThreatIndicators = (show: boolean) => {
    setShowThreatIndicatorsState(show);
  };

  const toggleThreatIndicators = () => {
    setShowThreatIndicatorsState((prev) => !prev);
  };

  return (
    <GamePreferencesContext.Provider
      value={{
        showThreatIndicators,
        setShowThreatIndicators,
        toggleThreatIndicators,
      }}
    >
      {children}
    </GamePreferencesContext.Provider>
  );
};

export const useGamePreferences = (): GamePreferencesContextType => {
  const context = useContext(GamePreferencesContext);
  if (!context) {
    throw new Error('useGamePreferences must be used within a GamePreferencesProvider');
  }
  return context;
};


