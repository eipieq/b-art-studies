import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { extractGradeFromText } from '@/lib/aiGrading';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1';

const resolveModelPath = (model?: string) => {
  const value =
    model ??
    process.env.GEMINI_TEXT_MODEL ??
    'models/gemini-1.5-pro-latest';
  return value.startsWith('models/') ? value : `models/${value}`;
};

export async function POST(request: NextRequest) {

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  const formData = await request.formData();

  const question = formData.get('question');
  const expectedAnswer = formData.get('expectedAnswer');
  const image = formData.get('image');
  const flashcardId = formData.get('flashcardId');
  const chapterId = formData.get('chapterId');

  if (
    typeof question !== 'string' ||
    typeof expectedAnswer !== 'string' ||
    !(image instanceof File)
  ) {
    return NextResponse.json(
      { error: 'Missing required fields: question, expectedAnswer, image.' },
      { status: 400 }
    );
  }

  if (typeof flashcardId !== 'string' || typeof chapterId !== 'string') {
    return NextResponse.json(
      { error: 'Missing required fields: flashcardId, chapterId.' },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = image.type || 'image/png';

    const instruction = [
      'You are a strict but encouraging tutor. Given a study question, the reference answer, and a learner answer provided as an image, assign a difficulty-aware score from 1 to 10 where 1 means completely incorrect and 10 means perfect.',
      'Return only a JSON object: {"score": <number>, "feedback": "<short actionable guidance>"} with no additional commentary.',
      `Question:\n${question}`,
      `Reference answer:\n${expectedAnswer}`,
    ].join('\n\n');

    const response = await fetch(
      `${GEMINI_API_BASE}/${resolveModelPath(process.env.GEMINI_VISION_MODEL)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: instruction },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
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
