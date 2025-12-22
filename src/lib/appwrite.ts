import { Client, Databases, Account } from 'appwrite';

type AppwriteEnvKey =
  | 'NEXT_PUBLIC_APPWRITE_ENDPOINT'
  | 'NEXT_PUBLIC_APPWRITE_PROJECT_ID'
  | 'NEXT_PUBLIC_APPWRITE_DATABASE_ID'
  | 'NEXT_PUBLIC_APPWRITE_COLLECTION_ID'
  | 'NEXT_PUBLIC_APPWRITE_CHAPTERS_COLLECTION_ID'
  | 'NEXT_PUBLIC_APPWRITE_RESPONSES_COLLECTION_ID';

const env = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
  collectionId: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID,
  chaptersCollectionId: process.env.NEXT_PUBLIC_APPWRITE_CHAPTERS_COLLECTION_ID,
  responsesCollectionId: process.env.NEXT_PUBLIC_APPWRITE_RESPONSES_COLLECTION_ID,
} as const;

const requireEnv = (value: string | undefined, key: AppwriteEnvKey): string => {
  if (!value) {
    throw new Error(`Missing Appwrite environment variable: ${key}`);
  }
  return value;
};

let cachedClient: Client | null = null;
let cachedDatabases: Databases | null = null;
let cachedAccount: Account | null = null;

export const getClient = (): Client => {
  if (!cachedClient) {
    cachedClient = new Client()
      .setEndpoint(requireEnv(env.endpoint, 'NEXT_PUBLIC_APPWRITE_ENDPOINT'))
      .setProject(requireEnv(env.projectId, 'NEXT_PUBLIC_APPWRITE_PROJECT_ID'));
  }
  return cachedClient;
};

export const getDatabases = (): Databases => {
  if (!cachedDatabases) {
    cachedDatabases = new Databases(getClient());
  }
  return cachedDatabases;
};

export const getAccount = (): Account => {
  if (!cachedAccount) {
    cachedAccount = new Account(getClient());
  }
  return cachedAccount;
};

export const getDatabaseId = (): string =>
  requireEnv(env.databaseId, 'NEXT_PUBLIC_APPWRITE_DATABASE_ID');
export const getCollectionId = (): string =>
  requireEnv(env.collectionId, 'NEXT_PUBLIC_APPWRITE_COLLECTION_ID');
export const getChaptersCollectionId = (): string =>
  requireEnv(env.chaptersCollectionId, 'NEXT_PUBLIC_APPWRITE_CHAPTERS_COLLECTION_ID');
export const getResponsesCollectionId = (): string =>
  requireEnv(env.responsesCollectionId, 'NEXT_PUBLIC_APPWRITE_RESPONSES_COLLECTION_ID');
