export type GradeResult = {
  score: number;
  feedback: string;
};

const SCORE_MIN = 1;
const SCORE_MAX = 10;

export const extractGradeFromText = (text: string): GradeResult => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Could not parse AI response.');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<GradeResult>;
  const score = Number(parsed.score);

  if (!Number.isFinite(score)) {
    throw new Error('AI returned an invalid score.');
  }

  const clampedScore = Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(score)));
  const feedback = typeof parsed.feedback === 'string' ? parsed.feedback : '';

  return {
    score: clampedScore,
    feedback,
  };
};
