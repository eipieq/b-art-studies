'use client';

import { useState, useEffect, FormEvent } from 'react';
import {
  getDatabases,
  getDatabaseId,
  getCollectionId,
  getChaptersCollectionId,
} from '@/lib/appwrite';
import { Chapter, Flashcard } from '@/types/flashcards';
import { Query } from 'appwrite';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './markdown.css';

const parseHints = (hints: Flashcard['hints']): string[] => {
  if (Array.isArray(hints)) {
    return hints;
  }

  if (typeof hints === 'string') {
    return hints
      .split('\n')
      .map((hint) => hint.trim())
      .filter(Boolean);
  }

  return [];
};

type MetadataField = { label: string; value: string };

type CardReview = {
  cardId: string;
  interval: number; // days until next review
  repetitions: number;
  easeFactor: number;
  nextReview: number; // timestamp
  lastReviewed: number; // timestamp
};

const getCardReviewData = (cardId: string): CardReview | null => {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(`card_${cardId}`);
  return data ? JSON.parse(data) : null;
};

const saveCardReviewData = (cardId: string, data: CardReview) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`card_${cardId}`, JSON.stringify(data));
};

const calculateNextReview = (
  quality: 'again' | 'good' | 'easy',
  cardData: CardReview | null
): CardReview => {
  const now = Date.now();

  if (!cardData) {
    // New card
    cardData = {
      cardId: '',
      interval: 0,
      repetitions: 0,
      easeFactor: 2.5,
      nextReview: now,
      lastReviewed: now,
    };
  }

  let newInterval: number;
  let newRepetitions: number;
  let newEaseFactor = cardData.easeFactor;

  if (quality === 'again') {
    // Reset the card
    newInterval = 0;
    newRepetitions = 0;
    newEaseFactor = Math.max(1.3, cardData.easeFactor - 0.2);
  } else if (quality === 'good') {
    newRepetitions = cardData.repetitions + 1;
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(cardData.interval * cardData.easeFactor);
    }
  } else {
    // easy
    newRepetitions = cardData.repetitions + 1;
    newEaseFactor = cardData.easeFactor + 0.15;
    if (newRepetitions === 1) {
      newInterval = 4;
    } else if (newRepetitions === 2) {
      newInterval = 10;
    } else {
      newInterval = Math.round(cardData.interval * newEaseFactor * 1.3);
    }
  }

  return {
    cardId: cardData.cardId,
    interval: newInterval,
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
    nextReview: now + newInterval * 24 * 60 * 60 * 1000,
    lastReviewed: now,
  };
};

export default function Home() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentFlashcard, setCurrentFlashcard] = useState<Flashcard | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flashcardCache, setFlashcardCache] = useState<Record<string, Flashcard[]>>({});
  const [userAnswer, setUserAnswer] = useState('');
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [gradeErrorSource, setGradeErrorSource] = useState<'text' | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [currentChapterFlashcards, setCurrentChapterFlashcards] = useState<Flashcard[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState<number | null>(null);
  const [appwriteError, setAppwriteError] = useState<string | null>(null);
  const [cardReviewData, setCardReviewData] = useState<CardReview | null>(null);

  useEffect(() => {
    fetchChapters();
  }, []);

  const resetInteractionState = () => {
    setShowAnswer(false);
    setUserAnswer('');
    setGradeError(null);
    setGradeErrorSource(null);
    setScore(null);
    setFeedback('');
  };

  const fetchChapters = async () => {
    try {
      setAppwriteError(null);
      const response = await getDatabases().listDocuments(
        getDatabaseId(),
        getChaptersCollectionId()
      );
      const documents = response.documents as unknown as Chapter[];
      setChapters(documents);
    } catch (error) {
      console.error('Failed to load chapters from Appwrite', error);
      setChapters([]);
      setAppwriteError(
        error instanceof Error
          ? error.message
          : 'Unable to load chapters. Please check the Appwrite configuration.'
      );
    }
  };

  const handleChapterSelect = async (chapterId: string) => {
    setAppwriteError(null);
    setSelectedChapterId(chapterId);
    const cachedFlashcards = flashcardCache[chapterId];

    if (cachedFlashcards) {
      setCurrentChapterFlashcards(cachedFlashcards);
      setCurrentFlashcardIndex(cachedFlashcards.length > 0 ? 0 : null);
      setCurrentFlashcard(cachedFlashcards[0] ?? null);
      resetInteractionState();
      return;
    }

    try {
      const response = await getDatabases().listDocuments(
        getDatabaseId(),
        getCollectionId(),
        [Query.equal('chapterId', chapterId)]
      );

      const documents = (response.documents ?? []) as unknown as Flashcard[];
      const normalized = documents.map((doc) => ({
        ...doc,
        hints: parseHints(doc.hints),
      }));

      setFlashcardCache((prev) => ({
        ...prev,
        [chapterId]: normalized,
      }));
      setCurrentChapterFlashcards(normalized);

      if (normalized.length > 0) {
        setCurrentFlashcard(normalized[0]);
        setCurrentFlashcardIndex(0);
      } else {
        setCurrentFlashcard(null);
        setCurrentFlashcardIndex(null);
        setCurrentChapterFlashcards([]);
      }
      resetInteractionState();
    } catch (error) {
      console.error('Failed to load flashcards for chapter', error);
      setCurrentFlashcard(null);
      setCurrentFlashcardIndex(null);
      setCurrentChapterFlashcards([]);
      resetInteractionState();
      setAppwriteError(
        error instanceof Error
          ? error.message
          : 'Unable to load flashcards. Please check the Appwrite configuration.'
      );
    }
  };

  const handleFlashcardNavigation = (direction: 1 | -1) => {
    if (!selectedChapterId) {
      return;
    }

    const flashcards = currentChapterFlashcards;

    if (!flashcards || flashcards.length === 0 || currentFlashcardIndex === null) {
      return;
    }

    const nextIndex = currentFlashcardIndex + direction;

    if (nextIndex < 0 || nextIndex >= flashcards.length) {
      return;
    }

    resetInteractionState();
    setCurrentFlashcard(flashcards[nextIndex]);
    setCurrentFlashcardIndex(nextIndex);
  };

  const handleSpacedRepetition = (quality: 'again' | 'good' | 'easy') => {
    if (!currentFlashcard) return;

    const existingData = getCardReviewData(currentFlashcard.$id);
    const newData = calculateNextReview(quality, existingData);
    newData.cardId = currentFlashcard.$id;

    saveCardReviewData(currentFlashcard.$id, newData);
    setCardReviewData(newData);

    // Move to next card after a short delay
    setTimeout(() => {
      handleFlashcardNavigation(1);
    }, 300);
  };

  useEffect(() => {
    if (currentFlashcard) {
      const data = getCardReviewData(currentFlashcard.$id);
      setCardReviewData(data);
    }
  }, [currentFlashcard]);

  const handleGradeAnswer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentFlashcard) {
      return;
    }

    const trimmedAnswer = userAnswer.trim();

    if (!trimmedAnswer) {
      setGradeError('Please enter an answer before submitting.');
      setGradeErrorSource('text');
      return;
    }

    if (!selectedChapterId) {
      setGradeError('Please select a chapter before grading.');
      setGradeErrorSource('text');
      return;
    }

    setGradeError(null);
    setGradeErrorSource(null);

    try {
      const response = await fetch('/api/grade', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: currentFlashcard.question,
          expectedAnswer: currentFlashcard.answer,
          userAnswer: trimmedAnswer,
          flashcardId: currentFlashcard.$id,
          chapterId: selectedChapterId,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage = errorPayload?.error ?? 'Unable to grade answer.';
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (typeof result.score !== 'number') {
        throw new Error('Received an invalid score from the AI grader.');
      }

      setScore(result.score);
      const normalizedFeedback = typeof result.feedback === 'string' ? result.feedback : '';
      setFeedback(normalizedFeedback);
      setShowAnswer(true);
    } catch (error) {
      setGradeError(error instanceof Error ? error.message : 'Unable to grade answer.');
      setGradeErrorSource('text');
      setScore(null);
      setFeedback('');
      setShowAnswer(false);
    }
  };

  const handleRetry = () => {
    resetInteractionState();
  };

  const metadataCandidates =
    currentFlashcard && [
      { label: 'Year', value: currentFlashcard.year },
      { label: 'Medium', value: currentFlashcard.medium },
      { label: 'Location', value: currentFlashcard.location },
    ];
  const metadataFields: MetadataField[] = (
    metadataCandidates ?? []
  ).filter(
    (field): field is MetadataField =>
      typeof field.value === 'string' && field.value.trim().length > 0
  );
  const hasPrevious =
    currentChapterFlashcards.length > 0 &&
    currentFlashcardIndex !== null &&
    currentFlashcardIndex > 0;
  const hasNext =
    currentChapterFlashcards.length > 0 &&
    currentFlashcardIndex !== null &&
    currentFlashcardIndex < currentChapterFlashcards.length - 1;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="hidden border-gray-100 bg-white lg:block lg:w-64 lg:border-r xl:w-72">
        <div className="px-6 py-8">
          <h2
            className="mb-4 font-semibold uppercase text-gray-700"
            style={{ fontFamily: 'var(--font-geist-mono)' }}
          >
            Chapters
          </h2>
          <ul className="space-y-2">
            {chapters.map((chapter) => {
              const isActive = selectedChapterId === chapter.$id;
              return (
                <li key={chapter.$id}>
                  <button
                    onClick={() => handleChapterSelect(chapter.$id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? 'bg-indigo-50 font-medium text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {chapter.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 xl:px-16 2xl:px-24">
        <div className="max-w-4xl">
          {appwriteError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {appwriteError}
            </div>
          )}
          {currentFlashcard ? (
            <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
              {cardReviewData && cardReviewData.repetitions > 0 && (
                <div className="mb-4 text-sm text-gray-500">
                  Reviews: {cardReviewData.repetitions} | Next review in: {Math.max(0, Math.ceil((cardReviewData.nextReview - Date.now()) / (1000 * 60 * 60 * 24)))} days
                </div>
              )}
              <h2 className="mb-8 text-2xl font-semibold text-gray-900">
                {currentFlashcard.question}
              </h2>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowAnswer((previous) => !previous)}
                  className="px-3 py-1 text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-900 hover:text-white transition"
                >
                  {showAnswer ? 'Hide Answer' : 'View Answer'}
                </button>
              </div>

              {score !== null && (
                <div className="mt-6">
                  <p className="text-lg font-semibold text-gray-800">Score: {score}/10</p>
                  {feedback && (
                    <div className="mt-2 text-sm text-gray-600 markdown-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {feedback}
                      </ReactMarkdown>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-4 px-3 py-1 text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-200"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {showAnswer && (
                <div className="mt-6">
                  <div className="markdown-content prose prose-lg max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {currentFlashcard.answer}
                    </ReactMarkdown>
                  </div>

                  <div className="mt-6">
                    <p className="text-base text-gray-600 mb-3">How well did you know this?</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleSpacedRepetition('again')}
                        className="px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition"
                      >
                        <div className="font-semibold">Again</div>
                        <div className="text-xs mt-0.5 opacity-75">Review soon</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpacedRepetition('good')}
                        className="px-4 py-2 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition"
                      >
                        <div className="font-semibold">Good</div>
                        <div className="text-xs mt-0.5 opacity-75">Normal interval</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpacedRepetition('easy')}
                        className="px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                      >
                        <div className="font-semibold">Easy</div>
                        <div className="text-xs mt-0.5 opacity-75">Longer interval</div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {metadataFields.length > 0 && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {metadataFields.map((field) => (
                    <div
                      key={field.label}
                      className="rounded-2xl border border-dashed border-gray-200 bg-white/80 p-3"
                    >
                      <p className="text-[11px] font-semibold text-gray-500">
                        {field.label}
                      </p>
                      <p className="text-sm font-semibold text-gray-800">{field.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleFlashcardNavigation(-1)}
                disabled={!hasPrevious}
                className="px-3 py-1 text-gray-800 rounded-full border border-gray-200 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => handleFlashcardNavigation(1)}
                disabled={!hasNext}
                className="px-3 py-1 text-gray-800 rounded-full border border-gray-200 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            </div>
          ) : (
            <p>Select a chapter to start.</p>
          )}
        </div>
      </main>
    </div>
  );
}
