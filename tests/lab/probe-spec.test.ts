import { describe, expect, it } from 'vitest';
import { validateProbeSpec } from '../../src/lab/probe-spec.js';

describe('validateProbeSpec', () => {
  it('accepts a minimal eval probe', () => {
    const errors = validateProbeSpec({
      id: 'probe-1',
      title: 'Ping',
      question: 'Does this tiny eval work?',
      mode: 'eval',
      code: '1 + 1',
      tags: ['sc-probe'],
    });

    expect(errors).toEqual([]);
  });

  it('rejects a render probe with missing render options', () => {
    const errors = validateProbeSpec({
      id: 'probe-2',
      title: 'Render',
      question: 'Can this render?',
      mode: 'render',
      code: '{ SinOsc.ar(440) }.play;',
      tags: ['sc-render-review'],
    });

    expect(errors).toContain('Render probes require render options.');
  });
});
