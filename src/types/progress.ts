export interface UserProgress {
  $id: string;
  userId: string;
  cardId: string;
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReview: number;
  lastReviewed: number;
  updatedAt: string;
  createdAt: string;
}

export interface ProgressSyncResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
}

export type CardReview = {
  cardId: string;
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReview: number;
  lastReviewed: number;
};
