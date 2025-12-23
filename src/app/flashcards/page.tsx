'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDatabases, getDatabaseId, getCollectionId, getChaptersCollectionId } from '@/lib/appwrite';
import { Query } from 'appwrite';
import type { Flashcard, Chapter } from '@/types/flashcards';

export default function FlashcardsPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load chapters
      const chaptersResponse = await getDatabases().listDocuments(
        getDatabaseId(),
        getChaptersCollectionId()
      );
      setChapters(chaptersResponse.documents as unknown as Chapter[]);

      // Load all flashcards
      const flashcardsResponse = await getDatabases().listDocuments(
        getDatabaseId(),
        getCollectionId(),
        [Query.limit(1000)] // Adjust as needed
      );
      setFlashcards(flashcardsResponse.documents as unknown as Flashcard[]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFlashcards = flashcards.filter(card => {
    const matchesChapter = selectedChapterId === 'all' || card.chapterId === selectedChapterId;
    const matchesSearch = !searchQuery ||
      card.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChapter && matchesSearch;
  });

  const getChapterName = (chapterId: string) => {
    return chapters.find(c => c.$id === chapterId)?.title || 'Unknown';
  };

  const getQuestionTypeBadge = (type?: string) => {
    if (!type || type === 'free-response') {
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Free Response</span>;
    } else if (type === 'mcq-single') {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">MCQ Single</span>;
    } else if (type === 'mcq-multiple') {
      return <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">MCQ Multiple</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading flashcards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">All Flashcards</h1>
            <div className="flex gap-3">
              <Link
                href="/"
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Study Mode
              </Link>
              <Link
                href="/admin"
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Admin Dashboard
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 items-center bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search questions or answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="w-64">
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Chapters ({flashcards.length})</option>
                {chapters.map(chapter => (
                  <option key={chapter.$id} value={chapter.$id}>
                    {chapter.title} ({flashcards.filter(f => f.chapterId === chapter.$id).length})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{filteredFlashcards.length}</div>
            <div className="text-sm text-gray-600">Total Cards</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">
              {filteredFlashcards.filter(f => !f.questionType || f.questionType === 'free-response').length}
            </div>
            <div className="text-sm text-gray-600">Free Response</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-green-600">
              {filteredFlashcards.filter(f => f.questionType === 'mcq-single').length}
            </div>
            <div className="text-sm text-gray-600">Single Choice</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-purple-600">
              {filteredFlashcards.filter(f => f.questionType === 'mcq-multiple').length}
            </div>
            <div className="text-sm text-gray-600">Multiple Choice</div>
          </div>
        </div>

        {/* Flashcards Grid */}
        <div className="space-y-4">
          {filteredFlashcards.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-600">No flashcards found. Create some in the admin dashboard!</p>
            </div>
          ) : (
            filteredFlashcards.map(card => (
              <div key={card.$id} className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getQuestionTypeBadge(card.questionType)}
                    <span className="text-sm text-gray-600">
                      {getChapterName(card.chapterId)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">ID: {card.$id.slice(0, 8)}</span>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Question: {card.question}
                  </h3>
                  <p className="text-gray-700">
                    <span className="font-medium">Answer:</span> {card.answer}
                  </p>
                </div>

                {/* MCQ Choices */}
                {card.choices && card.choices.length > 0 && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Choices:</p>
                    <div className="space-y-2">
                      {card.choices.map((choice, idx) => {
                        const isCorrect = card.correctChoices?.includes(idx);
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 text-sm ${
                              isCorrect ? 'text-green-700 font-medium' : 'text-gray-600'
                            }`}
                          >
                            <span className="w-6 text-center">{String.fromCharCode(65 + idx)}.</span>
                            <span>{choice}</span>
                            {isCorrect && <span className="text-xs">✓ Correct</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {(card.artworkTitle || card.artist || card.year || card.movement) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {card.artworkTitle && (
                        <div>
                          <span className="text-gray-600">Artwork:</span>{' '}
                          <span className="text-gray-900">{card.artworkTitle}</span>
                        </div>
                      )}
                      {card.artist && (
                        <div>
                          <span className="text-gray-600">Artist:</span>{' '}
                          <span className="text-gray-900">{card.artist}</span>
                        </div>
                      )}
                      {card.year && (
                        <div>
                          <span className="text-gray-600">Year:</span>{' '}
                          <span className="text-gray-900">{card.year}</span>
                        </div>
                      )}
                      {card.movement && (
                        <div>
                          <span className="text-gray-600">Movement:</span>{' '}
                          <span className="text-gray-900">{card.movement}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
