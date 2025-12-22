import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, ID } from 'appwrite';
import { getCollectionId, getDatabaseId } from '@/lib/appwrite';

const requireServiceKey = (): string => {
  const key = process.env.APPWRITE_SERVICE_KEY;
  if (!key) {
    throw new Error('APPWRITE_SERVICE_KEY is required for admin routes.');
  }
  return key;
};

const createAdminClient = (): Client => {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const serviceKey = requireServiceKey();

  if (!endpoint || !projectId) {
    throw new Error('Appwrite endpoint and project ID must be configured.');
  }

  const client = new Client();
  client.setEndpoint(endpoint);
  client.setProject(projectId);
  client.setDevKey(serviceKey);
  return client;
};

type ImportPayload = Array<{
  question?: string;
  answer?: string;
  chapterId?: string;
  artworkTitle?: string;
  artist?: string;
  story?: string;
  imageUrl?: string;
  year?: string;
  medium?: string;
  movement?: string;
  location?: string;
  hints?: string[];
}>;

export async function POST(request: NextRequest) {
  try {
    const { flashcards }: { flashcards?: ImportPayload } = (await request.json()) ?? {};
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json(
        { error: 'Provide an array of flashcards to import.' },
        { status: 400 }
      );
    }

    const databases = new Databases(createAdminClient());
    const nextPromises = flashcards.map(async (card) => {
      const question = card.question?.trim();
      const answer = card.answer?.trim();
      const chapterId = card.chapterId?.trim();

      if (!question || !answer || !chapterId) {
        throw new Error('Each flashcard must include question, answer, and chapterId.');
      }

      const data: Record<string, unknown> = {
        question,
        answer,
        chapterId,
      };

      const optionalFields: Array<keyof ImportPayload[number]> = [
        'artworkTitle',
        'artist',
        'story',
        'imageUrl',
        'year',
        'medium',
        'movement',
        'location',
      ];

      optionalFields.forEach((field) => {
        const value = card[field];
        if (typeof value === 'string' && value.trim()) {
          data[field] = value.trim();
        }
      });

      if (Array.isArray(card.hints) && card.hints.length > 0) {
        const sanitizedHints = card.hints.map((hint) => hint.trim()).filter(Boolean);
        if (sanitizedHints.length > 0) {
          data.hints = sanitizedHints.join('\n');
        }
      }

      return databases.createDocument(
        getDatabaseId(),
        getCollectionId(),
        ID.unique(),
        data
      );
    });

    const created = await Promise.all(nextPromises);

    return NextResponse.json({
      imported: created.length,
    });
  } catch (error) {
    console.error('Import failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to import flashcards.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
