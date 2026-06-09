import { describe, it, expect, vi } from 'vitest';
import {
  parseServerRunningOutput,
  probeServerStatus,
  formatCheckText,
} from '../../src/runtime/server-probe.js';

describe('parseServerRunningOutput', () => {
  it('returns running for true output', () => {
    expect(parseServerRunningOutput('-> true')).toBe('running');
  });

  it('returns not_running for false output', () => {
    expect(parseServerRunningOutput('-> false')).toBe('not_running');
  });

  it('returns unknown for empty or unparseable output', () => {
    expect(parseServerRunningOutput('')).toBe('unknown');
    expect(parseServerRunningOutput('ERROR: something')).toBe('unknown');
  });
});

describe('formatCheckText', () => {
  it('formats structured check output', () => {
    expect(formatCheckText('/usr/bin/sclang', 'not_running')).toBe(
      'sclang: OK\npath: /usr/bin/sclang\nserver: not_running',
    );
  });
});

describe('probeServerStatus', () => {
  it('returns running when execute succeeds with true', async () => {
    const controller = {
      execute: vi.fn().mockResolvedValue({ success: true, output: '-> true' }),
    };
    await expect(probeServerStatus(controller as any)).resolves.toBe('running');
  });

  it('returns not_running when execute succeeds with false', async () => {
    const controller = {
      execute: vi.fn().mockResolvedValue({ success: true, output: '-> false' }),
    };
    await expect(probeServerStatus(controller as any)).resolves.toBe('not_running');
  });

  it('returns unknown when execute fails', async () => {
    const controller = {
      execute: vi.fn().mockResolvedValue({ success: false, output: 'ERROR' }),
    };
    await expect(probeServerStatus(controller as any)).resolves.toBe('unknown');
  });

  it('returns unknown when execute throws', async () => {
    const controller = {
      execute: vi.fn().mockRejectedValue(new Error('timeout')),
    };
    await expect(probeServerStatus(controller as any)).resolves.toBe('unknown');
  });
});
