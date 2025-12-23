'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getDatabases,
  getDatabaseId,
  getChaptersCollectionId,
} from '@/lib/appwrite';
import { Chapter } from '@/types/flashcards';
import { useAuth } from '@/contexts/AuthContext';

const initialFlashcardState = {
  question: '',
  answer: '',
  chapterId: '',
  artworkTitle: '',
  artist: '',
  story: '',
  imageUrl: '',
  year: '',
  medium: '',
  movement: '',
  location: '',
  hints: '',
  questionType: 'free-response' as 'free-response' | 'mcq-single' | 'mcq-multiple',
  choice1: '',
  choice2: '',
  choice3: '',
  choice4: '',
  correctChoiceIndices: [] as number[],
};

export default function AdminPage() {
  const { user } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [flashcardForm, setFlashcardForm] = useState(initialFlashcardState);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [chapterStatus, setChapterStatus] = useState<string | null>(null);
  const [flashcardStatus, setFlashcardStatus] = useState<string | null>(null);
  const [isSavingChapter, setIsSavingChapter] = useState(false);
  const [isSavingFlashcard, setIsSavingFlashcard] = useState(false);
  const [importPayload, setImportPayload] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchChapters();
  }, []);

  const fetchChapters = async () => {
    setLoadingChapters(true);
    try {
      const response = await getDatabases().listDocuments(
        getDatabaseId(),
        getChaptersCollectionId()
      );
      const documents = ((response.documents ?? []) as unknown) as Chapter[];
      setChapters(documents);
      setFlashcardForm((prev) => ({
        ...prev,
        chapterId: prev.chapterId || documents[0]?.$id || '',
      }));
    } catch (error) {
      console.error('Failed to load chapters', error);
      setChapterStatus('Unable to load chapters. Check the Appwrite setup.');
    } finally {
      setLoadingChapters(false);
    }
  };

  const handleChapterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = chapterTitle.trim();
    if (!trimmedTitle) {
      setChapterStatus('Give the chapter a title.');
      return;
    }

    setIsSavingChapter(true);
    setChapterStatus(null);

    try {
      if (!user?.$id) {
        throw new Error('You must be logged in to create chapters');
      }

      const response = await fetch('/api/admin/chapters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: trimmedTitle, userId: user.$id }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || 'Unable to create chapter.');
      }

      setChapterTitle('');
      setChapterStatus('Chapter created successfully.');
      await fetchChapters();
    } catch (error) {
      console.error('Create chapter failed', error);
      setChapterStatus(
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setIsSavingChapter(false);
    }
  };

  const handleFlashcardChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFlashcardForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCorrectChoiceToggle = (choiceIndex: number) => {
    if (flashcardForm.questionType === 'mcq-single') {
      setFlashcardForm((prev) => ({
        ...prev,
        correctChoiceIndices: [choiceIndex],
      }));
    } else if (flashcardForm.questionType === 'mcq-multiple') {
      setFlashcardForm((prev) => ({
        ...prev,
        correctChoiceIndices: prev.correctChoiceIndices.includes(choiceIndex)
          ? prev.correctChoiceIndices.filter((idx) => idx !== choiceIndex)
          : [...prev.correctChoiceIndices, choiceIndex],
      }));
    }
  };

  const handleFlashcardSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = flashcardForm.question.trim();
    const trimmedAnswer = flashcardForm.answer.trim();
    if (!trimmedQuestion || !trimmedAnswer || !flashcardForm.chapterId) {
      setFlashcardStatus('Question, answer, and chapter are required.');
      return;
    }

    // MCQ validation
    if (flashcardForm.questionType !== 'free-response') {
      const choices = [
        flashcardForm.choice1.trim(),
        flashcardForm.choice2.trim(),
        flashcardForm.choice3.trim(),
        flashcardForm.choice4.trim(),
      ];

      if (choices.some((c) => !c)) {
        setFlashcardStatus('MCQ requires all 4 choices to be filled.');
        return;
      }

      if (flashcardForm.correctChoiceIndices.length === 0) {
        setFlashcardStatus('MCQ requires at least one correct answer.');
        return;
      }
    }

    setIsSavingFlashcard(true);
    setFlashcardStatus(null);

    const hintsArray = flashcardForm.hints
      .split('\n')
      .map((hint) => hint.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      question: trimmedQuestion,
      answer: trimmedAnswer,
      chapterId: flashcardForm.chapterId,
      artworkTitle: flashcardForm.artworkTitle.trim() || undefined,
      artist: flashcardForm.artist.trim() || undefined,
      story: flashcardForm.story.trim() || undefined,
      imageUrl: flashcardForm.imageUrl.trim() || undefined,
      year: flashcardForm.year.trim() || undefined,
      medium: flashcardForm.medium.trim() || undefined,
      movement: flashcardForm.movement.trim() || undefined,
      location: flashcardForm.location.trim() || undefined,
      hints: hintsArray.length > 0 ? hintsArray.join('\n') : undefined,
      questionType: flashcardForm.questionType,
    };

    // Add MCQ-specific fields
    if (flashcardForm.questionType !== 'free-response') {
      payload.choices = [
        flashcardForm.choice1.trim(),
        flashcardForm.choice2.trim(),
        flashcardForm.choice3.trim(),
        flashcardForm.choice4.trim(),
      ];
      payload.correctChoices = flashcardForm.correctChoiceIndices;
    }

    try {
      if (!user?.$id) {
        throw new Error('You must be logged in to create flashcards');
      }

      const response = await fetch('/api/admin/flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, userId: user.$id }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || 'Unable to create flashcard.');
      }

      setFlashcardForm((prev) => ({
        ...initialFlashcardState,
        chapterId: prev.chapterId,
        questionType: 'free-response',
        choice1: '',
        choice2: '',
        choice3: '',
        choice4: '',
        correctChoiceIndices: [],
      }));
      setFlashcardStatus('Flashcard created successfully.');
    } catch (error) {
      console.error('Create flashcard failed', error);
      setFlashcardStatus(
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setIsSavingFlashcard(false);
    }
  };

  const handleImportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importPayload.trim()) {
      setImportStatus('Paste JSON payload before importing.');
      return;
    }

    setIsImporting(true);
    setImportStatus(null);

    try {
      const parsed = JSON.parse(importPayload);

      // Support both formats:
      // 1. { "flashcards": [...] } (recommended)
      // 2. [...] (direct array)
      let flashcards: unknown[] = [];

      if (Array.isArray(parsed)) {
        flashcards = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.flashcards)) {
        flashcards = parsed.flashcards;
      }

      if (flashcards.length === 0) {
        throw new Error('Provide a JSON array of flashcards or an object with a "flashcards" array property.');
      }

      if (!user?.$id) {
        throw new Error('You must be logged in to import flashcards');
      }

      const response = await fetch('/api/admin/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flashcards, userId: user.$id }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || 'Import failed.');
      }

      setImportStatus('Imported flashcards successfully.');
    } catch (error) {
      console.error('Import failed', error);
      setImportStatus(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage chapters and flashcards
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-800 transition hover:bg-gray-100"
        >
          Back to App
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Chapters</h2>
            <span className="text-xs text-gray-500">
              {loadingChapters ? 'Loading...' : `${chapters.length} total`}
            </span>
          </div>
          <form className="space-y-3" onSubmit={handleChapterSubmit}>
            <label className="text-sm font-medium text-gray-700 block">
              Chapter title
              <input
                value={chapterTitle}
                onChange={(event) => setChapterTitle(event.target.value)}
                disabled={isSavingChapter}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Renaissance Art"
              />
            </label>
            <button
              type="submit"
              disabled={isSavingChapter}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingChapter ? 'Creating...' : 'Create Chapter'}
            </button>
          </form>
          {chapterStatus && (
            <p className="mt-3 text-sm text-gray-600">{chapterStatus}</p>
          )}
          {chapters.length > 0 && (
            <ul className="mt-6 space-y-2 text-sm text-gray-700">
              {chapters.map((chapter) => (
                <li key={chapter.$id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {chapter.title}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Flashcards</h2>
            <p className="text-sm text-gray-600 mt-1">Add a new question/answer pair</p>
          </div>
          <form className="space-y-4" onSubmit={handleFlashcardSubmit}>
            <label className="block text-sm font-medium text-gray-700">
              Chapter
              <select
                name="chapterId"
                value={flashcardForm.chapterId}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard || loadingChapters}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.$id} value={chapter.$id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Question
              <textarea
                name="question"
                value={flashcardForm.question}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ask about the artist, movement, or specific work"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Answer
              <textarea
                name="answer"
                value={flashcardForm.answer}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard}
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Provide a clear explanation"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Question Type
              <select
                name="questionType"
                value={flashcardForm.questionType}
                onChange={(e) => {
                  setFlashcardForm((prev) => ({
                    ...prev,
                    questionType: e.target.value as typeof prev.questionType,
                    choice1: '',
                    choice2: '',
                    choice3: '',
                    choice4: '',
                    correctChoiceIndices: [],
                  }));
                }}
                disabled={isSavingFlashcard}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="free-response">Free Response</option>
                <option value="mcq-single">Multiple Choice (Single Answer)</option>
                <option value="mcq-multiple">Multiple Choice (Select All)</option>
              </select>
            </label>
            {(flashcardForm.questionType === 'mcq-single' ||
              flashcardForm.questionType === 'mcq-multiple') && (
              <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-sm font-semibold text-indigo-900">
                  {flashcardForm.questionType === 'mcq-multiple'
                    ? 'Answer Choices (Select all correct answers):'
                    : 'Answer Choices (Select one correct answer):'}
                </p>
                {[1, 2, 3, 4].map((num) => {
                  const choiceKey = `choice${num}` as 'choice1' | 'choice2' | 'choice3' | 'choice4';
                  const choiceIndex = num - 1;
                  const isCorrect = flashcardForm.correctChoiceIndices.includes(choiceIndex);

                  return (
                    <div key={num} className="flex items-start gap-2">
                      <input
                        type={flashcardForm.questionType === 'mcq-single' ? 'radio' : 'checkbox'}
                        name="correct-choice"
                        checked={isCorrect}
                        onChange={() => handleCorrectChoiceToggle(choiceIndex)}
                        disabled={isSavingFlashcard}
                        className="mt-3"
                        title="Mark as correct answer"
                      />
                      <div className="flex-1">
                        <label className="text-xs text-gray-600 mb-1 block">
                          Choice {num}
                        </label>
                        <input
                          name={choiceKey}
                          value={flashcardForm[choiceKey]}
                          onChange={handleFlashcardChange}
                          disabled={isSavingFlashcard}
                          placeholder={`Enter choice ${num}`}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="artworkTitle"
                value={flashcardForm.artworkTitle}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard}
                placeholder="Artwork title"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                name="artist"
                value={flashcardForm.artist}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard}
                placeholder="Artist name"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <input
              name="imageUrl"
              value={flashcardForm.imageUrl}
              onChange={handleFlashcardChange}
              disabled={isSavingFlashcard}
              placeholder="Image URL"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              name="story"
              value={flashcardForm.story}
              onChange={handleFlashcardChange}
              disabled={isSavingFlashcard}
              rows={2}
              placeholder="Story or memorable note"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <input
                name="year"
                value={flashcardForm.year}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard}
                placeholder="Year"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                name="medium"
                value={flashcardForm.medium}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard}
                placeholder="Medium"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                name="movement"
                value={flashcardForm.movement}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard}
                placeholder="Movement"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="location"
                value={flashcardForm.location}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard}
                placeholder="Location"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                name="hints"
                value={flashcardForm.hints}
                onChange={handleFlashcardChange}
                disabled={isSavingFlashcard}
                rows={2}
                placeholder="Hints (one per line)"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingFlashcard}
              className="w-full rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingFlashcard ? 'Saving...' : 'Create Flashcard'}
            </button>
          </form>
          {flashcardStatus && (
            <p className="mt-3 text-sm text-gray-600">{flashcardStatus}</p>
          )}
          <form className="mt-8 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4" onSubmit={handleImportSubmit}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Import Flashcards</p>
              <span className="text-xs text-gray-500">JSON</span>
            </div>
            <p className="text-xs text-gray-600">
              Paste a JSON array of flashcards to import in bulk
            </p>
            <textarea
              value={importPayload}
              onChange={(event) => setImportPayload(event.target.value)}
              placeholder={`[{"chapterId":"...","question":"...","answer":"..."}]`}
              className="h-32 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isImporting}
            />
            <button
              type="submit"
              disabled={isImporting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImporting ? 'Importing...' : 'Import Flashcards'}
            </button>
            {importStatus && (
              <p className="text-xs text-gray-600">{importStatus}</p>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
