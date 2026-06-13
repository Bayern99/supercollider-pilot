import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ArchiveStore } from '../../src/archive/archive-store.js';
import { CandidateRegistry } from '../../src/lab/candidate-registry.js';

describe('CandidateRegistry', () => {
  it('rebuilds candidate state from append-only lifecycle and review events', async () => {
    const archive = new ArchiveStore(path.join(os.tmpdir(), `scctl-candidates-${Date.now()}`));
    const registry = new CandidateRegistry(archive);

    await registry.createDraft({
      candidate_id: 'cand-1',
      name: 'metal-bloom',
      source_probe_id: 'probe-1',
      session_id: 'session-1',
      artifacts: [{ kind: 'render', path: '/tmp/a.wav', bytes: 10 }],
      metadata: { family: 'metal' },
    });
    await registry.promote('session-1', 'cand-1', 'Strong enough to compare.');
    await registry.rename('session-2', 'cand-1', 'metal-bloom-v2', 'Name is more precise.');
    await registry.split('session-2', 'cand-1', ['cand-1a', 'cand-1b'], 'Separate attack and tail.');
    await registry.addReview('session-3', 'cand-1', {
      reviewer: 'qa',
      verdict: 'revisit',
      summary: 'Interesting transient, unstable sustain.',
    });
    await registry.revisit('session-3', 'cand-1', 'Needs another pass.');
    await registry.deprecate('session-4', 'cand-1', ['cand-2'], 'Replaced by cleaner version.');

    const candidate = await registry.getCandidate('cand-1');

    expect(candidate.name).toBe('metal-bloom-v2');
    expect(candidate.status).toBe('rejected');
    expect(candidate.split_into).toEqual(['cand-1a', 'cand-1b']);
    expect(candidate.superseded_by).toEqual(['cand-2']);
    expect(candidate.reviews).toHaveLength(1);
    expect(candidate.history.map((event) => event.action)).toEqual([
      'create',
      'promote',
      'rename',
      'split',
      'revisit',
      'deprecate',
    ]);
  });
});
