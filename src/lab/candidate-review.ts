import { CandidateReviewNote } from './lab-types.js';

export function createReviewNote(input: CandidateReviewNote): CandidateReviewNote {
  if (!input.reviewer.trim()) {
    throw new Error('Review note requires a reviewer.');
  }

  if (!input.summary.trim()) {
    throw new Error('Review note requires a summary.');
  }

  return {
    ...input,
    created_at: input.created_at ?? new Date().toISOString(),
  };
}
