import { describe, expect, it } from 'vitest';
import { getTaskPolicy, PILOT_TASK_POLICIES } from '../../src/harness/policies.js';

describe('task policies', () => {
  it('defines a stable policy for every supported task tag', () => {
    expect(Object.keys(PILOT_TASK_POLICIES).sort()).toEqual([
      'sc-audio-generation',
      'sc-probe',
      'sc-render-review',
    ]);
  });

  it('requires render output and review for audio generation tasks', () => {
    const policy = getTaskPolicy('sc-audio-generation');

    expect(policy).not.toBeNull();
    expect(policy?.allowed_terminal_actions).toEqual(['render', 'render_nrt']);
    expect(policy?.requires_render_artifact).toBe(true);
    expect(policy?.requires_review_note).toBe(true);
    expect(policy?.requires_scd_source).toBe(true);
  });

  it('returns null when no supported task tag is provided', () => {
    expect(getTaskPolicy(null)).toBeNull();
  });
});
