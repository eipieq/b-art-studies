import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, ID } from 'appwrite';
import { getDatabaseId, getChaptersCollectionId } from '@/lib/appwrite';

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

export async function POST(request: NextRequest) {
  try {
    const databases = new Databases(createAdminClient());
    const payload = (await request.json()) as { title?: string };
    const title = payload.title?.trim();

    if (!title) {
      return NextResponse.json(
        { error: 'Chapter title is required.' },
        { status: 400 }
      );
    }

    const document = await databases.createDocument(
      getDatabaseId(),
      getChaptersCollectionId(),
      ID.unique(),
      { title }
    );

    return NextResponse.json(document);
  } catch (error) {
    console.error('Failed to create chapter:', error);
    const message = error instanceof Error ? error.message : 'Unable to create chapter.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
