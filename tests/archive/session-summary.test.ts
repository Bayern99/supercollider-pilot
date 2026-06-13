import { describe, expect, it } from 'vitest';
import { buildSessionSummary } from '../../src/archive/session-summary.js';

describe('buildSessionSummary', () => {
  it('captures the probe result, preserved items, and failures in one summary object', () => {
    const summary = buildSessionSummary({
      session_id: 'session-1',
      task: 'Primitive probe review',
      outcome: 'mixed',
      preserved_items: ['cand-1', 'render:/tmp/a.wav'],
      failures: ['candidate sustain was unstable'],
      notes: ['rerun with lower noise floor'],
      probe: {
        probe_id: 'probe-1',
        session_id: 'session-1',
        success: true,
        summary: 'render ok',
        raw_output: 'ok',
        artifacts: [],
        started_at: '2026-06-13T00:00:00.000Z',
        finished_at: '2026-06-13T00:00:01.000Z',
      },
    });

    expect(summary.probe_id).toBe('probe-1');
    expect(summary.summary).toContain('Primitive probe review ended mixed.');
    expect(summary.summary).toContain('Preserved: cand-1, render:/tmp/a.wav.');
    expect(summary.summary).toContain('Failures: candidate sustain was unstable.');
  });
});
