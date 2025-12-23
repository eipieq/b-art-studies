import { getDatabases, getDatabaseId, getProgressCollectionId } from '@/lib/appwrite';
import { Query, ID } from 'appwrite';
import type { UserProgress, CardReview } from '@/types/progress';

/**
 * Fetch all progress records for user
 */
export async function fetchUserProgress(userId: string): Promise<UserProgress[]> {
  const databases = getDatabases();
  const response = await databases.listDocuments(
    getDatabaseId(),
    getProgressCollectionId(),
    [Query.equal('userId', userId)]
  );
  return response.documents as unknown as UserProgress[];
}

/**
 * Fetch progress for specific card
 */
export async function fetchCardProgress(
  userId: string,
  cardId: string
): Promise<UserProgress | null> {
  const databases = getDatabases();
  const response = await databases.listDocuments(
    getDatabaseId(),
    getProgressCollectionId(),
    [
      Query.equal('userId', userId),
      Query.equal('cardId', cardId),
      Query.limit(1)
    ]
  );
  return (response.documents[0] as unknown as UserProgress) ?? null;
}

/**
 * Save or update card progress with conflict resolution
 */
export async function saveCardProgress(
  userId: string,
  cardId: string,
  reviewData: {
    interval: number;
    repetitions: number;
    easeFactor: number;
    nextReview: number;
    lastReviewed: number;
  },
  resolveConflicts: boolean = true
): Promise<UserProgress> {
  const databases = getDatabases();

  try {
    const existing = await fetchCardProgress(userId, cardId);

    // Conflict resolution: keep most recent data
    if (existing && resolveConflicts) {
      if (existing.lastReviewed > reviewData.lastReviewed) {
        console.log(`Skipping card ${cardId} - database has newer data`);
        return existing;
      }
    }

    if (existing) {
      // Update
      const updated = await databases.updateDocument(
        getDatabaseId(),
        getProgressCollectionId(),
        existing.$id,
        reviewData
      );
      return updated as unknown as UserProgress;
    } else {
      // Create
      const created = await databases.createDocument(
        getDatabaseId(),
        getProgressCollectionId(),
        ID.unique(),
        { userId, cardId, ...reviewData }
      );
      return created as unknown as UserProgress;
    }
  } catch (error) {
    console.error('Error saving card progress:', error);
    throw error;
  }
}

/**
 * Get all localStorage progress data
 */
export function getLocalStorageProgress(): Array<{ cardId: string; data: CardReview }> {
  if (typeof window === 'undefined') return [];

  const backups: Array<{ cardId: string; data: CardReview }> = [];
  const prefix = 'card_';

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const cardId = key.substring(prefix.length);
      const dataStr = localStorage.getItem(key);
      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          backups.push({ cardId, data });
        } catch (e) {
          console.error(`Failed to parse ${key}:`, e);
        }
      }
    }
  }

  return backups;
}
