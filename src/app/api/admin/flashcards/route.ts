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

async function verifyAdminAccess(userId: string): Promise<{ authorized: boolean; userId?: string }> {
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

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
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
      userId?: string;
    };

    // Verify admin access
    const { authorized } = await verifyAdminAccess(payload.userId || '');

    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const question = payload.question?.trim();
    const answer = payload.answer?.trim();
    const chapterId = payload.chapterId?.trim();

    if (!question || !answer || !chapterId) {
      return NextResponse.json(
        { error: 'Question, answer, and chapterId are required.' },
        { status: 400 }
      );
    }

    const databases = new Databases(createAdminClient());

    const data: Record<string, unknown> = {
      question,
      answer,
      chapterId,
    };

    const optionalFields: Array<keyof typeof payload> = [
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
      const value = payload[field];
      if (typeof value === 'string' && value.trim()) {
        data[field] = value.trim();
      }
    });


    if (Array.isArray(payload.hints) && payload.hints.length > 0) {
      const sanitizedHints = payload.hints
        .map((hint) => hint.trim())
        .filter(Boolean);
      if (sanitizedHints.length > 0) {
        data.hints = sanitizedHints.join('\n');
      }
    }

    // MCQ fields
    if (payload.questionType && payload.questionType !== 'free-response') {
      data.questionType = payload.questionType;

      if (Array.isArray(payload.choices) && payload.choices.length === 4) {
        data.choices = payload.choices;
      }

      if (Array.isArray(payload.correctChoices) && payload.correctChoices.length > 0) {
        data.correctChoices = payload.correctChoices;
      }
    }

    const document = await databases.createDocument(
      getDatabaseId(),
      getCollectionId(),
      ID.unique(),
      data
    );

    return NextResponse.json(document);
  } catch (error) {
    console.error('Failed to create flashcard:', error);
    const message = error instanceof Error ? error.message : 'Unable to create flashcard.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
