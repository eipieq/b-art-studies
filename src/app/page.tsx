'use client';

import { useState, useEffect, useMemo, FormEvent } from 'react';
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
import { useProgress } from '@/contexts/ProgressContext';

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
  const { getCardProgress, updateCardProgress } = useProgress();
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
  const [selectedChoiceIndices, setSelectedChoiceIndices] = useState<number[]>([]);
  const [showChoices, setShowChoices] = useState(false);
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [mcqCorrect, setMcqCorrect] = useState<boolean | null>(null);
  const [mcqPartialScore, setMcqPartialScore] = useState(0);
  const [flashcardSearchQuery, setFlashcardSearchQuery] = useState('');
  const [showQuestionBrowser, setShowQuestionBrowser] = useState(false);

  useEffect(() => {
    fetchChapters();
  }, []);

  const resetInteractionState = (flashcard: Flashcard | null = null) => {
    setShowAnswer(false);
    setUserAnswer('');
    setGradeError(null);
    setGradeErrorSource(null);
    setScore(null);
    setFeedback('');
    setSelectedChoiceIndices([]);
    setShowChoices(
      !!flashcard &&
        (flashcard.questionType === 'mcq-single' ||
          flashcard.questionType === 'mcq-multiple')
    );
    setMcqSubmitted(false);
    setMcqCorrect(null);
    setMcqPartialScore(0);
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
      resetInteractionState(cachedFlashcards[0] ?? null);
      return;
    }

    try {
      const response = await getDatabases().listDocuments(
        getDatabaseId(),
        getCollectionId(),
        [
          Query.equal('chapterId', chapterId),
          Query.limit(1000), // ensure we fetch beyond the default page size
        ]
      );

      const documents = (response.documents ?? []) as unknown as Flashcard[];
      const normalized = documents.map((doc) => ({
        ...doc,
        hints: parseHints(doc.hints),
      }));

      // Debug: Log flashcard types
      console.log('Loaded flashcards:', normalized.map(f => ({
        id: f.$id,
        questionType: f.questionType || 'undefined',
        hasChoices: !!f.choices,
        choicesCount: f.choices?.length
      })));

      setFlashcardCache((prev) => ({
        ...prev,
        [chapterId]: normalized,
      }));
      setCurrentChapterFlashcards(normalized);

      if (normalized.length > 0) {
        const firstCard = normalized[0];
        setCurrentFlashcard(firstCard);
        setCurrentFlashcardIndex(0);
        resetInteractionState(firstCard);
      } else {
        setCurrentFlashcard(null);
        setCurrentFlashcardIndex(null);
        setCurrentChapterFlashcards([]);
        resetInteractionState(null);
      }
    } catch (error) {
      console.error('Failed to load flashcards for chapter', error);
      setCurrentFlashcard(null);
      setCurrentFlashcardIndex(null);
      setCurrentChapterFlashcards([]);
      resetInteractionState(null);
      setAppwriteError(
        error instanceof Error
          ? error.message
          : 'Unable to load flashcards. Please check the Appwrite configuration.'
      );
    }
  };

  const handleFlashcardPick = (flashcardId: string) => {
    const index = currentChapterFlashcards.findIndex((card) => card.$id === flashcardId);
    if (index === -1) {
      return;
    }

    const selectedCard = currentChapterFlashcards[index];
    resetInteractionState(selectedCard);
    setCurrentFlashcard(selectedCard);
    setCurrentFlashcardIndex(index);
  };

  const filteredChapterFlashcards = useMemo(() => {
    const query = flashcardSearchQuery.trim().toLowerCase();
    if (!query) {
      return currentChapterFlashcards;
    }

    return currentChapterFlashcards.filter((card) =>
      card.question.toLowerCase().includes(query) ||
      card.answer.toLowerCase().includes(query)
    );
  }, [currentChapterFlashcards, flashcardSearchQuery]);

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

    const nextFlashcard = flashcards[nextIndex];
    resetInteractionState(nextFlashcard);
    setCurrentFlashcard(nextFlashcard);
    setCurrentFlashcardIndex(nextIndex);
  };

  const handleSpacedRepetition = async (quality: 'again' | 'good' | 'easy') => {
    if (!currentFlashcard) return;

    const existingData = getCardProgress(currentFlashcard.$id);
    const newData = calculateNextReview(quality, existingData);
    newData.cardId = currentFlashcard.$id;

    await updateCardProgress(currentFlashcard.$id, newData);
    setCardReviewData(newData);

    // Move to next card after a short delay
    setTimeout(() => {
      handleFlashcardNavigation(1);
    }, 300);
  };

  useEffect(() => {
    if (currentFlashcard) {
      const data = getCardProgress(currentFlashcard.$id);
      setCardReviewData(data);
    }
  }, [currentFlashcard, getCardProgress]);

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
    resetInteractionState(currentFlashcard ?? null);
  };

  const handleChoiceToggle = (choiceIndex: number) => {
    if (mcqSubmitted) return;

    if (currentFlashcard?.questionType === 'mcq-single') {
      setSelectedChoiceIndices([choiceIndex]);
    } else if (currentFlashcard?.questionType === 'mcq-multiple') {
      setSelectedChoiceIndices((prev) =>
        prev.includes(choiceIndex)
          ? prev.filter((idx) => idx !== choiceIndex)
          : [...prev, choiceIndex]
      );
    }
  };

  const handleMcqSubmit = () => {
    if (!currentFlashcard || !currentFlashcard.correctChoices) {
      return;
    }

    const selectedSorted = [...selectedChoiceIndices].sort((a, b) => a - b);
    const correctSorted = [...currentFlashcard.correctChoices].sort((a, b) => a - b);

    const isPerfectMatch =
      selectedSorted.length === correctSorted.length &&
      selectedSorted.every((val, idx) => val === correctSorted[idx]);

    const correctChoiceSet = new Set(currentFlashcard.correctChoices);
    const correctSelectionCount = selectedChoiceIndices.filter((idx) =>
      correctChoiceSet.has(idx)
    ).length;
    const incorrectSelectionCount = selectedChoiceIndices.filter(
      (idx) => !correctChoiceSet.has(idx)
    ).length;

    let partialScore = 0;
    if (correctChoiceSet.size > 0) {
      partialScore = (correctSelectionCount - incorrectSelectionCount) / correctChoiceSet.size;
      partialScore = Math.max(0, Math.min(1, partialScore));
    }

    setMcqSubmitted(true);
    setMcqCorrect(isPerfectMatch);
    setMcqPartialScore(partialScore);
    setShowAnswer(true);
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
  const isCurrentFlashcardMcq =
    currentFlashcard?.questionType === 'mcq-single' ||
    currentFlashcard?.questionType === 'mcq-multiple';
  const currentFlashcardHasChoices =
    (currentFlashcard?.choices?.length ?? 0) > 0;
  const mcqResultLabel = mcqCorrect
    ? 'Correct'
    : mcqPartialScore > 0
    ? 'Partially Correct'
    : 'Incorrect';
  const mcqResultClasses = mcqCorrect
    ? 'border-emerald-500 bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
    : mcqPartialScore > 0
    ? 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200'
    : 'border-rose-500 bg-rose-100 text-rose-900 hover:bg-rose-200';
  const mcqResultDetail = mcqCorrect
    ? 'Nice work—keep it up!'
    : mcqPartialScore > 0
    ? `Partial credit: ${Math.round(mcqPartialScore * 100)}%`
    : 'Review the hint and try again.';
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

              {isCurrentFlashcardMcq ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setShowChoices((prev) => !prev)}
                      disabled={!currentFlashcardHasChoices}
                      className="px-4 py-2 text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {showChoices ? 'Hide Choices' : 'Show Choices'}
                    </button>
                  </div>

                  {currentFlashcardHasChoices ? (
                    showChoices && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-gray-600 mb-3">
                          {currentFlashcard.questionType === 'mcq-multiple'
                            ? 'Select all that apply:'
                            : 'Select one:'}
                        </p>
                        {currentFlashcard.choices?.map((choice, idx) => {
                          const isSelected = selectedChoiceIndices.includes(idx);
                          const isCorrect = currentFlashcard.correctChoices?.includes(idx);
                          const showFeedback = mcqSubmitted;

                          let borderClass = 'border-gray-200';
                          let bgClass = 'bg-white';

                          if (showFeedback) {
                            if (isCorrect) {
                              borderClass = 'border-green-500';
                              bgClass = 'bg-green-50';
                            } else if (isSelected && !isCorrect) {
                              borderClass = 'border-red-500';
                              bgClass = 'bg-red-50';
                            }
                          }

                          return (
                            <label
                              key={idx}
                              className={`flex items-start gap-3 p-4 rounded-lg border ${borderClass} ${bgClass} cursor-pointer transition ${
                                mcqSubmitted ? 'cursor-default' : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type={
                                  currentFlashcard.questionType === 'mcq-single'
                                    ? 'radio'
                                    : 'checkbox'
                                }
                                name="mcq-choice"
                                checked={isSelected}
                                onChange={() => handleChoiceToggle(idx)}
                                disabled={mcqSubmitted}
                                className="mt-1"
                              />
                              <span className="text-sm text-gray-800 flex-1">
                                {choice}
                              </span>
                              {showFeedback && isCorrect && (
                                <span className="text-green-600 text-xs font-semibold">
                                  ✓ Correct
                                </span>
                              )}
                            </label>
                          );
                        })}

                        {!mcqSubmitted && (
                          <button
                            type="button"
                            onClick={handleMcqSubmit}
                            disabled={selectedChoiceIndices.length === 0}
                            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Submit Answer
                          </button>
                        )}

                        {mcqSubmitted && mcqCorrect !== null && (
                          <div className="space-y-1">
                            <div
                              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm font-semibold transition ${mcqResultClasses}`}
                              role="status"
                              aria-live="polite"
                            >
                              <span
                                className={`text-base leading-none ${
                                  mcqCorrect
                                    ? 'text-emerald-700'
                                    : mcqPartialScore > 0
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                                }`}
                                aria-hidden="true"
                              >
                                {mcqCorrect ? '✓' : '✗'}
                              </span>
                              <span>{mcqResultLabel}</span>
                            </div>
                            <p className="text-xs text-gray-600">{mcqResultDetail}</p>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-gray-500">
                      No answer choices have been configured for this MCQ yet.
                    </p>
                  )}

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAnswer((prev) => !prev)}
                  className="px-3 py-1 text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-900 hover:text-white transition"
                >
                  {showAnswer ? 'Hide Answer' : 'View Answer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowAnswer((previous) => !previous)}
                className="px-3 py-1 text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-900 hover:text-white transition"
              >
                {showAnswer ? 'Hide Answer' : 'View Answer'}
              </button>
            </div>
          )}

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

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowQuestionBrowser((prev) => !prev)}
                className="px-3 py-1 text-gray-800 rounded-full border border-gray-200 hover:bg-gray-100 transition"
              >
                {showQuestionBrowser ? 'Hide question list' : 'Browse questions'}
              </button>
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
          {showQuestionBrowser && (
            <div className="fixed bottom-5 right-5 z-40 w-full max-w-xs rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg shadow-gray-900/20 backdrop-blur-sm sm:max-w-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-700">
                  Questions ({filteredChapterFlashcards.length}/{currentChapterFlashcards.length})
                </p>
                <button
                  type="button"
                  onClick={() => setShowQuestionBrowser(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Close
                </button>
              </div>
              <input
                type="search"
                value={flashcardSearchQuery}
                onChange={(event) => setFlashcardSearchQuery(event.target.value)}
                placeholder="Filter by question or answer..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {filteredChapterFlashcards.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No questions match that filter yet.
                  </p>
                ) : (
                  filteredChapterFlashcards.map((card) => {
                    const isActive = currentFlashcard?.$id === card.$id;
                    return (
                      <button
                        key={card.$id}
                        type="button"
                        onClick={() => handleFlashcardPick(card.$id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition focus:outline-none ${
                          isActive
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'
                        }`}
                      >
                        <p className="font-semibold">{card.question}</p>
                        <p className="text-[11px] text-gray-500">
                          {card.questionType || 'Free response'}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
