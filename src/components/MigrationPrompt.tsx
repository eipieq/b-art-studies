'use client';

import { useState } from 'react';
import { useProgress } from '@/contexts/ProgressContext';

export default function MigrationPrompt() {
  const { needsMigration, triggerMigration } = useProgress();
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (!needsMigration || dismissed) return null;

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await triggerMigration();
      if (res.success) {
        setResult(`Successfully synced ${res.migratedCount} cards!`);
        setTimeout(() => setDismissed(true), 3000);
      } else {
        setResult(`Migration failed: ${res.errors.join(', ')}`);
      }
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-indigo-200 bg-indigo-50 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-indigo-900">Sync Your Progress</h3>
          <p className="mt-1 text-sm text-indigo-700">
            You have local progress data. Sync it to the cloud for multi-device access.
          </p>
          {result && (
            <p className={`mt-2 text-sm font-medium ${result.includes('failed') ? 'text-red-700' : 'text-green-700'}`}>
              {result}
            </p>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-indigo-500 hover:text-indigo-700"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {migrating ? 'Syncing...' : 'Sync Now'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg border border-indigo-300 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-100 transition"
        >
          Later
        </button>
      </div>
    </div>
  );
}
