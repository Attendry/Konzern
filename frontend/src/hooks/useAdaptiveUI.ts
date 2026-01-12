import { useState, useEffect, useCallback } from 'react';

interface UserPreferences {
  preferredView?: 'compact' | 'comfortable' | 'spacious';
  showTooltips?: boolean;
  autoSave?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

interface AdaptiveUIContext {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void;
  resetPreferences: () => void;
}

const defaultPreferences: UserPreferences = {
  preferredView: 'comfortable',
  showTooltips: true,
  autoSave: true,
  theme: 'auto',
};

export function useAdaptiveUI(): AdaptiveUIContext {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const stored = localStorage.getItem('adaptiveUI');
    return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
  });

  useEffect(() => {
    localStorage.setItem('adaptiveUI', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    localStorage.removeItem('adaptiveUI');
  }, []);

  return {
    preferences,
    updatePreference,
    resetPreferences,
  };
}

// Hook for learning user patterns
export function useUserPatterns() {
  const [patterns, setPatterns] = useState<{
    frequentActions: Map<string, number>;
    preferredRoutes: Map<string, number>;
    timeOfDay: Map<string, number>;
  }>(() => {
    const stored = localStorage.getItem('userPatterns');
    return stored
      ? JSON.parse(stored)
      : {
          frequentActions: {},
          preferredRoutes: {},
          timeOfDay: {},
        };
  });

  const recordAction = useCallback((actionId: string) => {
    setPatterns((prev) => {
      const newPatterns = { ...prev };
      newPatterns.frequentActions[actionId] = (newPatterns.frequentActions[actionId] || 0) + 1;
      return newPatterns;
    });
  }, []);

  const recordRoute = useCallback((route: string) => {
    setPatterns((prev) => {
      const newPatterns = { ...prev };
      newPatterns.preferredRoutes[route] = (newPatterns.preferredRoutes[route] || 0) + 1;
      return newPatterns;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('userPatterns', JSON.stringify(patterns));
  }, [patterns]);

  const getMostFrequentActions = useCallback((limit = 5) => {
    return Object.entries(patterns.frequentActions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([actionId]) => actionId);
  }, [patterns]);

  return {
    patterns,
    recordAction,
    recordRoute,
    getMostFrequentActions,
  };
}