import { describe, expect, it } from 'vitest';
import { evaluateCompletion } from '../../src/harness/completion-rules.js';
import { DriverResult, RenderArtifact } from '../../src/runtime/driver-types.js';

function makeRenderResult(
  overrides: Partial<DriverResult<RenderArtifact>> = {},
): DriverResult<RenderArtifact> {
  return {
    success: true,
    state: 'stopped',
    phase: 'render',
    session_id: 'session-1',
    recoverable: true,
    error_kind: null,
    summary: 'rendered',
    raw_output: 'ok',
    artifact: {
      path: '/tmp/out.wav',
      bytes: 128,
      duration_sec: 2,
      verification: {
        exists: true,
        non_empty: true,
        output_error_detected: false,
        stop_completed: true,
        failure_reasons: [],
      },
    },
    session: {
      state: 'stopped',
      phase: 'render',
      session_id: 'session-1',
      engine_path: '/mock/sclang',
      has_controller: false,
      busy: false,
      last_error_kind: null,
      recoverable: true,
    },
    ...overrides,
  };
}

describe('completion rules', () => {
  it('marks missing task tags as not_applicable', () => {
    const result = evaluateCompletion({
      action: 'run',
      result: {
        ...makeRenderResult({
          phase: 'run_file',
          state: 'ready',
          artifact: undefined,
        }),
        artifact: undefined,
      },
      sourceKind: 'scd_file',
      sourcePath: '/tmp/test.scd',
      surface: 'cli',
    });

    expect(result.status).toBe('not_applicable');
    expect(result.route.action).toBe('run');
    expect(result.used_pilot).toBe(true);
  });

  it('passes valid sc-audio-generation renders with a .scd source', () => {
    const result = evaluateCompletion({
      action: 'render',
      result: makeRenderResult(),
      sourceKind: 'scd_file',
      sourcePath: '/tmp/test.scd',
      surface: 'mcp',
      taskTag: 'sc-audio-generation',
    });

    expect(result.status).toBe('passed');
    expect(result.requires_render_artifact).toBe(true);
    expect(result.requires_source).toBe(true);
    expect(result.route.source_path).toBe('/tmp/test.scd');
  });

  it('fails sc-audio-generation when no valid artifact exists', () => {
    const result = evaluateCompletion({
      action: 'render',
      result: makeRenderResult({
        success: false,
        error_kind: 'render_failed',
        artifact: {
          path: '/tmp/out.wav',
          bytes: 0,
          duration_sec: 2,
          verification: {
            exists: false,
            non_empty: false,
            output_error_detected: false,
            stop_completed: true,
            failure_reasons: ['Output WAV file was not created.'],
          },
        },
      }),
      sourceKind: 'scd_file',
      sourcePath: '/tmp/test.scd',
      surface: 'cli',
      taskTag: 'sc-audio-generation',
    });

    expect(result.status).toBe('failed');
    expect(result.artifact_complete).toBe(false);
    expect(result.reasons).toContain(
      'A valid non-empty render artifact is required for this task.',
    );
  });

  it('passes valid sc-audio-generation render_nrt with a .scd source', () => {
    const result = evaluateCompletion({
      action: 'render_nrt',
      result: makeRenderResult({
        phase: 'render_nrt',
        artifact: {
          ...makeRenderResult().artifact!,
          render_mode: 'nrt',
          engine_used: 'scsynth',
        },
      }),
      sourceKind: 'scd_file',
      sourcePath: '/tmp/final-nrt.scd',
      surface: 'cli',
      taskTag: 'sc-audio-generation',
    });

    expect(result.status).toBe('passed');
    expect(result.route.action).toBe('render_nrt');
  });

  it('fails unsupported task tags without breaking the underlying result', () => {
    const result = evaluateCompletion({
      action: 'render',
      result: makeRenderResult(),
      sourceKind: 'inline_code',
      surface: 'mcp',
      taskTag: 'unknown-tag',
    });

    expect(result.status).toBe('failed');
    expect(result.task_tag).toBe('unknown-tag');
    expect(result.reasons[0]).toContain('Unsupported task tag');
  });
});
