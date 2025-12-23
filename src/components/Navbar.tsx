'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProgress } from '@/contexts/ProgressContext';
import AuthModal from './auth/AuthModal';

interface NavbarProps {
  yarndings20ClassName?: string;
  brandName: string;
}

export default function Navbar({
  brandName,
}: NavbarProps) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { syncing, needsMigration } = useProgress();
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <nav className="inset-x-0 top-0 z-50 border-b border-gray-100 bg-white">
        <div className="max-w mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-2xl font-semibold text-indigo-700"
            >
              {brandName}
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/flashcards"
                className="text-sm text-gray-700 hover:text-indigo-600 font-medium transition"
              >
                Browse Cards
              </Link>

              {syncing && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing...
                </span>
              )}

              {needsMigration && isAuthenticated && (
                <span className="text-xs text-orange-600 font-medium">
                  Progress ready to sync
                </span>
              )}

              {isAuthenticated ? (
                <>
                  <span className="text-sm text-gray-700">
                    {user?.name || user?.email}
                  </span>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Admin
                    </Link>
                  )}

                  <button
                    onClick={logout}
                    className="text-sm text-gray-600 hover:text-gray-800 transition"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}
