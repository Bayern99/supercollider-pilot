import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ArchiveStore } from '../../src/archive/archive-store.js';

describe('ArchiveStore', () => {
  it('appends newline-delimited records and can read them back by kind and session', async () => {
    const archive = new ArchiveStore(path.join(os.tmpdir(), `scctl-archive-${Date.now()}`));

    await archive.append({
      kind: 'probe_run',
      session_id: 'session-1',
      payload: { probe_id: 'probe-1' },
      created_at: '2026-06-13T00:00:00.000Z',
    });
    await archive.append({
      kind: 'session_summary',
      session_id: 'session-1',
      payload: { summary: 'done' },
      created_at: '2026-06-13T00:00:01.000Z',
    });

    const all = await archive.readAll();
    const probeRuns = await archive.listByKind<{ probe_id: string }>('probe_run');
    const sessionRecords = await archive.listBySession('session-1');

    expect(all).toHaveLength(2);
    expect(probeRuns[0].payload.probe_id).toBe('probe-1');
    expect(sessionRecords).toHaveLength(2);
  });

  it('builds a memory summary from persisted archive records', async () => {
    const archive = new ArchiveStore(path.join(os.tmpdir(), `scctl-archive-summary-${Date.now()}`));

    await archive.append({
      kind: 'candidate_lifecycle',
      session_id: 'session-1',
      payload: {
        candidate_id: 'cand-1',
        event: {
          candidate_id: 'cand-1',
          to_status: 'accepted',
        },
      },
      created_at: '2026-06-13T00:00:00.000Z',
    });
    await archive.append({
      kind: 'session_summary',
      session_id: 'session-1',
      payload: {
        outcome: 'success',
        preserved_items: ['cand-1'],
        failures: [],
      },
      created_at: '2026-06-13T00:00:01.000Z',
    });

    const summary = await archive.buildMemorySummary();

    expect(summary.records_considered).toBe(2);
    expect(summary.candidate_counts_by_status.accepted).toBe(1);
    expect(summary.session_outcomes.success).toBe(1);
  });
});
