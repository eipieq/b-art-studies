export interface Flashcard {
  $id: string;
  question: string;
  chapter: string;
  answer: string;
  createdAt: string;
  chapterId: string;
  updatedAt: string;
  artworkTitle?: string;
  imageUrl?: string;
  movement?: string;
  year?: string;
  medium?: string;
  location?: string;
  hints?: string | string[];
  artist?: string;
  story?: string;
  questionType?: 'free-response' | 'mcq-single' | 'mcq-multiple';
  choices?: string[];
  correctChoices?: number[];
}

export interface Chapter {
  $id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  $id: string;
  userId: string;
  flashcardId: string;
  chapterId: string;
  question: string;
  expectedAnswer: string;
  userAnswer: string;
  submissionType: 'text' | 'image';
  imageName: string | null;
  score: number;
  feedback: string;
  createdAt: string;
}
