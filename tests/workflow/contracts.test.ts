import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { ArchiveMemorySummary } from '../../src/archive/archive-types.js';
import type { ProbeDriver } from '../../src/lab/lab-types.js';
import { WORKFLOW_TRANSPORTS } from './transport-contracts.js';

const { mockBuildArchiveMemorySummary } = vi.hoisted(() => ({
  mockBuildArchiveMemorySummary: vi.fn((_records: unknown, options: any = {}): ArchiveMemorySummary => ({
    records_considered: options.limit ?? 0,
    recent_sessions: [],
    candidate_counts_by_status: {},
    review_rejection_reason_distribution: {},
    repeated_failures: [],
    preserved_item_patterns: [],
    probe_run_outcomes: { total: 0, success: 0, failure: 0 },
    probe_run_modes: {},
    render_mode_outcomes: {},
    nrt_failure_distribution: {},
    final_artifact_completion_ratio: 0,
    session_outcomes: {},
  })),
}));

vi.mock('../../src/archive/memory-summary.js', () => ({
  buildMemorySummary: vi.fn(async (_archive: unknown, input: any = {}) => ({
    records_considered: input.limit ?? 0,
    recent_sessions: [],
    candidate_counts_by_status: {},
    review_rejection_reason_distribution: {},
    repeated_failures: [],
    preserved_item_patterns: [],
    probe_run_outcomes: { total: 0, success: 0, failure: 0 },
    probe_run_modes: {},
    render_mode_outcomes: {},
    nrt_failure_distribution: {},
    final_artifact_completion_ratio: 0,
    session_outcomes: {},
  })),
  buildArchiveMemorySummary: mockBuildArchiveMemorySummary,
}));

import { WorkflowService } from '../../src/workflow/service.js';

function workflowResultKeys(cliName: string): readonly string[] {
  const contract = WORKFLOW_TRANSPORTS.find((entry) => entry.cli === cliName);
  if (!contract) {
    throw new Error(`Unknown workflow transport: ${cliName}`);
  }

  return contract.resultKeys;
}

function makeDriver(): ProbeDriver {
  return {
    eval: vi.fn(async () => ({
      success: true,
      summary: 'eval ok',
      raw_output: '1',
    })),
    runFile: vi.fn(async () => ({
      success: true,
      summary: 'file ok',
      raw_output: 'ran file',
    })),
    render: vi.fn(async () => ({
      success: true,
      summary: 'render ok',
      raw_output: 'rendered',
      artifact: {
        path: '/tmp/render.wav',
        bytes: 256,
        duration_sec: 0.25,
      },
    })),
    renderNrt: vi.fn(async () => ({
      success: true,
      summary: 'render nrt ok',
      raw_output: 'rendered nrt',
      artifact: {
        path: '/tmp/render-nrt.wav',
        bytes: 512,
        duration_sec: 0.5,
        render_mode: 'nrt' as const,
        engine_used: 'scsynth' as const,
        sample_rate: 48000,
        sample_format: 'float' as const,
        channel_count: 2,
        frame_count: 24000,
      },
    })),
  };
}

function makeService(driver: ProbeDriver) {
  return new WorkflowService({
    driver: driver as any,
    archiveRoot: path.join(os.tmpdir(), `scctl-workflow-contracts-${Date.now()}-${Math.random()}`),
  });
}

describe('workflow surface result contracts', () => {
  it('keeps the plan-workflow result narrow and serializable', async () => {
    const result = await makeService(makeDriver()).planWorkflow({
      context: {
        task_label: 'sc-probe',
        requested_outcome: 'explore',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        action: 'plan_workflow',
        error_kind: null,
        archive_root: expect.any(String),
        payload: expect.objectContaining({
          selection: expect.objectContaining({
            workflow: expect.any(String),
            confidence: expect.stringMatching(/high|medium/),
            reasons: expect.any(Array),
            recommended_execution_mode: expect.any(String),
            recommended_tools: expect.any(Array),
            primary_role: expect.any(String),
          }),
        }),
      }),
    );
    if (!result.success) {
      throw new Error(result.summary);
    }
    expect(Object.keys(result.payload.selection)).toEqual(
      expect.arrayContaining([...workflowResultKeys('plan-workflow')]),
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('keeps the run-probe result aligned with archive-facing JSON', async () => {
    const result = await makeService(makeDriver()).runProbeCommand({
      spec: {
        id: 'probe-contract',
        title: 'Probe contract',
        question: 'Does the workflow surface preserve probe shape?',
        mode: 'render',
        code: '{ PinkNoise.ar(0.05) }.play;',
        render: {
          duration_sec: 0.25,
          out_path: '/tmp/render.wav',
        },
        tags: ['sc-render-review'],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        action: 'run_probe',
        error_kind: null,
        archive_root: expect.any(String),
        payload: expect.objectContaining({
          evals: expect.any(Object),
          probe_run: expect.objectContaining({
            probe_id: 'probe-contract',
            session_id: expect.any(String),
            success: true,
            summary: expect.any(String),
            raw_output: expect.any(String),
            artifacts: expect.any(Array),
            started_at: expect.any(String),
            finished_at: expect.any(String),
          }),
        }),
      }),
    );
    if (!result.success) {
      throw new Error(result.summary);
    }
    expect(Object.keys(result.payload.probe_run)).toEqual(
      expect.arrayContaining([...workflowResultKeys('run-probe')]),
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('keeps the summarize-session result concise and self-contained', async () => {
    const result = await makeService(makeDriver()).summarizeSessionCommand({
      session_id: 'session-1',
      task: 'Primitive probe review',
      outcome: 'mixed',
      preserved_items: ['cand-1', 'render:/tmp/a.wav'],
      failures: ['candidate sustain was unstable'],
      notes: ['rerun with lower noise floor'],
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        action: 'summarize_session',
        payload: expect.objectContaining({
          record_id: expect.any(String),
          summary: expect.objectContaining({
            session_id: 'session-1',
            task: 'Primitive probe review',
            outcome: 'mixed',
            summary: expect.any(String),
            preserved_items: expect.any(Array),
            failures: expect.any(Array),
            notes: expect.any(Array),
            created_at: expect.any(String),
          }),
        }),
      }),
    );
    if (!result.success) {
      throw new Error(result.summary);
    }
    expect(Object.keys(result.payload.summary)).toEqual(
      expect.arrayContaining([...workflowResultKeys('summarize-session')]),
    );
  });

  it('treats candidate-action as a candidate-state contract, not a loose log blob', async () => {
    const result = await makeService(makeDriver()).candidateActionCommand({
      session_id: 'session-1',
      action: 'create_draft',
      candidate_id: 'cand-1',
      name: 'metal-bloom',
      source_probe_id: 'probe-1',
      artifacts: [{ kind: 'render', path: '/tmp/a.wav', bytes: 10 }],
      metadata: { family: 'metal' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        action: 'candidate_action',
        payload: expect.objectContaining({
          candidate: expect.objectContaining({
            id: 'cand-1',
            name: 'metal-bloom',
            status: 'draft',
            source_probe_id: 'probe-1',
            created_at: expect.any(String),
            updated_at: expect.any(String),
            artifacts: expect.any(Array),
            reviews: expect.any(Array),
            history: expect.any(Array),
            metadata: expect.any(Object),
          }),
        }),
      }),
    );
    if (!result.success) {
      throw new Error(result.summary);
    }
    expect(Object.keys(result.payload.candidate)).toEqual(
      expect.arrayContaining([...workflowResultKeys('candidate-action')]),
    );
  });

  it('keeps the memory-summary contract aggregated and JSON-native', async () => {
    const expected = {
      records_considered: 4,
      recent_sessions: [
        {
          session_id: 'session-1',
          last_recorded_at: '2026-06-13T00:00:03.000Z',
          record_count: 3,
          audit_count: 0,
          kinds: ['probe_run', 'session_summary'],
          candidate_ids: ['cand-1'],
          probe_ids: ['probe-1'],
          outcomes: ['mixed'],
        },
      ],
      candidate_counts_by_status: {
        candidate: 1,
      },
      review_rejection_reason_distribution: {
        noisy_tail: 1,
      },
      repeated_failures: [
        {
          failure: 'candidate sustain was unstable',
          count: 2,
          session_ids: ['session-1', 'session-2'],
          candidate_ids: ['cand-1'],
        },
      ],
      preserved_item_patterns: [
        {
          pattern: 'render',
          count: 1,
          examples: ['render:/tmp/a.wav'],
        },
      ],
      probe_run_outcomes: {
        total: 2,
        success: 1,
        failure: 1,
      },
      probe_run_modes: {
        render: 2,
      },
      render_mode_outcomes: {
        draft: {
          total: 2,
          success: 1,
          failure: 1,
        },
      },
      nrt_failure_distribution: {},
      final_artifact_completion_ratio: 0,
      session_outcomes: {
        mixed: 1,
        failure: 1,
      },
    } satisfies ArchiveMemorySummary;
    mockBuildArchiveMemorySummary.mockReturnValueOnce(expected);

    const result = await makeService(makeDriver()).memorySummaryCommand({ limit: 4 });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        action: 'memory_summary',
        payload: expect.objectContaining({
          memory_summary: expect.objectContaining({
            records_considered: expect.any(Number),
            recent_sessions: expect.any(Array),
            candidate_counts_by_status: expect.any(Object),
            review_rejection_reason_distribution: expect.any(Object),
            repeated_failures: expect.any(Array),
            preserved_item_patterns: expect.any(Array),
            probe_run_outcomes: expect.objectContaining({
              total: expect.any(Number),
              success: expect.any(Number),
              failure: expect.any(Number),
            }),
            probe_run_modes: expect.any(Object),
            render_mode_outcomes: expect.any(Object),
            nrt_failure_distribution: expect.any(Object),
            final_artifact_completion_ratio: expect.any(Number),
            session_outcomes: expect.any(Object),
          }),
        }),
      }),
    );
    if (!result.success) {
      throw new Error(result.summary);
    }
    expect(Object.keys(result.payload.memory_summary)).toEqual(
      expect.arrayContaining([...workflowResultKeys('memory-summary')]),
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
