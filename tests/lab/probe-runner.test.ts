import { describe, expect, it, vi } from 'vitest';
import { ArchiveStore } from '../../src/archive/archive-store.js';
import { ProbeDriver } from '../../src/lab/lab-types.js';
import { runProbe } from '../../src/lab/probe-runner.js';

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

describe('runProbe', () => {
  it('routes eval probes through the abstract driver contract', async () => {
    const driver = makeDriver();

    const result = await runProbe(driver, {
      id: 'probe-eval',
      title: 'Eval probe',
      question: 'Does eval work?',
      mode: 'eval',
      code: '1 + 1',
      tags: ['sc-probe'],
    });

    expect(driver.eval).toHaveBeenCalledWith('1 + 1');
    expect(result.success).toBe(true);
    expect(result.artifacts).toEqual([{ kind: 'log', label: 'probe output' }]);
  });

  it('appends probe runs to the archive and records render artifacts', async () => {
    const rootDir = await import('os').then(({ tmpdir }) =>
      import('path').then(({ join }) => join(tmpdir(), `scctl-probe-${Date.now()}`)),
    );
    const archive = new ArchiveStore(rootDir);
    const driver = makeDriver();

    const result = await runProbe(
      driver,
      {
        id: 'probe-render',
        title: 'Render probe',
        question: 'Does render work?',
        mode: 'render',
        code: '{ PinkNoise.ar(0.1) }.play;',
        render: {
          duration_sec: 0.25,
          out_path: '/tmp/render.wav',
        },
        tags: ['sc-render-review'],
      },
      {
        session_id: 'session-render',
        archive,
      },
    );

    const records = await archive.listByKind<any>('probe_run');

    expect(result.artifacts).toEqual([
      {
        kind: 'render',
        path: '/tmp/render.wav',
        bytes: 256,
        duration_sec: 0.25,
        label: '0.25s render',
      },
      {
        kind: 'log',
        label: 'probe output',
      },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].payload.result.probe_id).toBe('probe-render');
  });
});
