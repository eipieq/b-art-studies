import { NextResponse } from 'next/server';
import { Client, Databases } from 'node-appwrite';

export async function GET() {
  try {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const serviceKey = process.env.APPWRITE_SERVICE_KEY;
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

    console.log('Testing Appwrite connection...');
    console.log('Endpoint:', endpoint);
    console.log('Project ID:', projectId);
    console.log('Database ID:', databaseId);
    console.log('Service Key exists:', !!serviceKey);
    console.log('Service Key length:', serviceKey?.length);

    if (!endpoint || !projectId || !serviceKey || !databaseId) {
      return NextResponse.json({
        error: 'Missing configuration',
        endpoint: !!endpoint,
        projectId: !!projectId,
        serviceKey: !!serviceKey,
        databaseId: !!databaseId
      });
    }

    const client = new Client();
    client.setEndpoint(endpoint);
    client.setProject(projectId);
    client.setKey(serviceKey);

    const databases = new Databases(client);

    console.log('Attempting to list collections...');
    const collections = await databases.listCollections(databaseId);

    console.log('Success! Collections:', collections.collections.map((c: any) => c.name));

    return NextResponse.json({
      success: true,
      message: 'API key is working!',
      collections: collections.collections.map((c: any) => ({
        id: c.$id,
        name: c.name
      }))
    });
  } catch (error: any) {
    console.error('Test failed:', error);
    return NextResponse.json({
      error: error.message,
      type: error.type,
      code: error.code,
      response: error.response
    }, { status: 500 });
  }
}
