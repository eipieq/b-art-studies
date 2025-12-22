import { NextRequest, NextResponse } from 'next/server';
import { extractGradeFromText } from '@/lib/aiGrading';

type GradeRequestPayload = {
  question?: string;
  expectedAnswer?: string;
  userAnswer?: string;
  flashcardId?: string;
  chapterId?: string;
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1';

const resolveModelPath = (model?: string) => {
  const value = model ?? 'models/gemini-1.5-pro-latest';
  return value.startsWith('models/') ? value : `models/${value}`;
};

export async function POST(request: NextRequest) {
  // Optional authentication - grade without auth, but save if authenticated
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as GradeRequestPayload;
  const { question, expectedAnswer, userAnswer, flashcardId, chapterId } = payload;

  if (!question || !expectedAnswer || !userAnswer) {
    return NextResponse.json(
      { error: 'Missing required fields: question, expectedAnswer, userAnswer.' },
      { status: 400 }
    );
  }

  if (!flashcardId || !chapterId) {
    return NextResponse.json(
      { error: 'Missing required fields: flashcardId, chapterId.' },
      { status: 400 }
    );
  }

  const prompt = [
    'You are a strict but encouraging tutor. Given a study question, the reference answer, and a learner answer, assign a difficulty-aware score from 1 to 10 where 1 means completely incorrect and 10 means perfect.',
    'Return only a JSON object: {"score": <number>, "feedback": "<short actionable guidance>"} with no extra commentary.',
    `Question:\n${question}`,
    `Reference answer:\n${expectedAnswer}`,
    `Learner answer:\n${userAnswer}`,
  ].join('\n\n');

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${resolveModelPath(process.env.GEMINI_TEXT_MODEL)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 200,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      const message =
        errorPayload?.error?.message ?? errorPayload?.error ?? response.statusText;
      throw new Error(message || 'Failed to contact Google Gemini.');
    }

    const completion = await response.json();
    const content: string =
      completion?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part?.text ?? '')
        .join('')
        .trim() ?? '';

    if (!content) {
      throw new Error('AI did not return a response.');
    }

    const grade = extractGradeFromText(content);

    return NextResponse.json(grade);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to grade answer.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
