'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchUserProgress,
  saveCardProgress,
  getLocalStorageProgress
} from '@/lib/progressSync';
import {
  migrateLocalProgressToDatabase,
  hasLocalProgressToMigrate
} from '@/lib/migration';
import type { UserProgress, CardReview, ProgressSyncResult } from '@/types/progress';

interface ProgressContextType {
  progressCache: Map<string, UserProgress>;
  getCardProgress: (cardId: string) => CardReview | null;
  updateCardProgress: (cardId: string, data: CardReview) => Promise<void>;
  refreshProgress: () => Promise<void>;
  triggerMigration: () => Promise<ProgressSyncResult>;
  needsMigration: boolean;
  syncing: boolean;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [progressCache, setProgressCache] = useState<Map<string, UserProgress>>(new Map());
  const [syncing, setSyncing] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);

  // Load progress when user authenticates
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserProgress();
      checkMigrationNeeded();
    } else {
      setProgressCache(new Map());
    }
  }, [isAuthenticated, user]);

  const loadUserProgress = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const progress = await fetchUserProgress(user.$id);
      const newCache = new Map<string, UserProgress>();
      progress.forEach(p => newCache.set(p.cardId, p));
      setProgressCache(newCache);
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setSyncing(false);
    }
  };

  const checkMigrationNeeded = () => {
    setNeedsMigration(hasLocalProgressToMigrate());
  };

  const getCardProgress = useCallback((cardId: string): CardReview | null => {
    if (isAuthenticated) {
      const dbProgress = progressCache.get(cardId);
      if (dbProgress) {
        return {
          cardId: dbProgress.cardId,
          interval: dbProgress.interval,
          repetitions: dbProgress.repetitions,
          easeFactor: dbProgress.easeFactor,
          nextReview: dbProgress.nextReview,
          lastReviewed: dbProgress.lastReviewed
        };
      }
      return null;
    }

    // Fallback to localStorage
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(`card_${cardId}`);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }, [isAuthenticated, progressCache]);

  const updateCardProgress = async (cardId: string, data: CardReview) => {
    if (isAuthenticated && user) {
      try {
        const saved = await saveCardProgress(user.$id, cardId, {
          interval: data.interval,
          repetitions: data.repetitions,
          easeFactor: data.easeFactor,
          nextReview: data.nextReview,
          lastReviewed: data.lastReviewed
        });
        setProgressCache(prev => new Map(prev).set(cardId, saved));
      } catch (error) {
        console.error('Save failed, using localStorage:', error);
        localStorage.setItem(`card_${cardId}`, JSON.stringify(data));
      }
    } else {
      localStorage.setItem(`card_${cardId}`, JSON.stringify(data));
    }
  };

  const triggerMigration = async (): Promise<ProgressSyncResult> => {
    if (!user) {
      return { success: false, migratedCount: 0, errors: ['Not authenticated'] };
    }

    setSyncing(true);
    try {
      const result = await migrateLocalProgressToDatabase(user.$id, { clearLocal: true });
      if (result.success) {
        setNeedsMigration(false);
        await loadUserProgress();
      }
      return result;
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ProgressContext.Provider
      value={{
        progressCache,
        getCardProgress,
        updateCardProgress,
        refreshProgress: loadUserProgress,
        triggerMigration,
        needsMigration,
        syncing
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within ProgressProvider');
  }
  return context;
};
