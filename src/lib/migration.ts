import { getLocalStorageProgress, saveCardProgress } from './progressSync';
import type { ProgressSyncResult } from '@/types/progress';

/**
 * Migrate localStorage to database
 */
export async function migrateLocalProgressToDatabase(
  userId: string,
  options: { clearLocal?: boolean } = {}
): Promise<ProgressSyncResult> {
  const localData = getLocalStorageProgress();

  if (localData.length === 0) {
    return { success: true, migratedCount: 0, errors: [] };
  }

  let migratedCount = 0;
  const errors: string[] = [];

  for (const { cardId, data } of localData) {
    try {
      await saveCardProgress(userId, cardId, {
        interval: data.interval,
        repetitions: data.repetitions,
        easeFactor: data.easeFactor,
        nextReview: data.nextReview,
        lastReviewed: data.lastReviewed
      });
      migratedCount++;
    } catch (error) {
      errors.push(`Failed to migrate ${cardId}: ${error}`);
    }
  }

  // Clear localStorage after successful migration
  if (options.clearLocal && errors.length === 0) {
    localData.forEach(({ cardId }) => {
      localStorage.removeItem(`card_${cardId}`);
    });
  }

  return {
    success: errors.length === 0,
    migratedCount,
    errors
  };
}

/**
 * Check if migration is needed
 */
export function hasLocalProgressToMigrate(): boolean {
  return getLocalStorageProgress().length > 0;
}
