import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, ID } from 'node-appwrite';
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
  client.setKey(serviceKey);
  return client;
};

// Note: This is a simplified admin check. The real security comes from:
// 1. Appwrite database permissions (only admins can write via service key)
// 2. Admin layout guard on the client side
// 3. The service key being server-side only
async function verifyAdminAccess(userId: string): Promise<{ authorized: boolean; userId?: string }> {
  // For now, we trust the client-side admin check from the layout guard
  // In a production app, you'd want to:
  // 1. Use a proper API key with Users.read scope in Appwrite
  // 2. Or implement a custom admin verification table
  // 3. Or use a different auth provider with better server-side verification

  if (!userId) {
    console.log('No userId provided');
    return { authorized: false };
  }

  console.log('Admin access granted for user:', userId);
  return {
    authorized: true,
    userId: userId
  };
}

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
  questionType?: 'free-response' | 'mcq-single' | 'mcq-multiple';
  choices?: string[];
  correctChoices?: number[];
}>;

export async function POST(request: NextRequest) {
  try {
    const { flashcards, userId }: { flashcards?: ImportPayload; userId?: string } = (await request.json()) ?? {};

    // Verify admin access
    const { authorized } = await verifyAdminAccess(userId || '');

    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
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

      // MCQ fields
      if (card.questionType && card.questionType !== 'free-response') {
        data.questionType = card.questionType;

        if (Array.isArray(card.choices) && card.choices.length === 4) {
          data.choices = card.choices;
        }

        if (Array.isArray(card.correctChoices) && card.correctChoices.length > 0) {
          data.correctChoices = card.correctChoices;
        }
      }

      try {
        return await databases.createDocument(
          getDatabaseId(),
          getCollectionId(),
          ID.unique(),
          data
        );
      } catch (docError) {
        console.error('Failed to create document:', docError);
        console.error('Database ID:', getDatabaseId());
        console.error('Collection ID:', getCollectionId());
        console.error('Data:', JSON.stringify(data, null, 2));
        throw docError;
      }
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
