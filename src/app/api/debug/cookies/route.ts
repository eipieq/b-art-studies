import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    return NextResponse.json({
      cookies: allCookies.map(c => ({
        name: c.name,
        value: c.value.substring(0, 50) + '...',
        hasValue: !!c.value
      })),
      count: allCookies.length,
      projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
      expectedCookieName: `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
