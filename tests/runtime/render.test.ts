import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  escapeScString,
  buildRenderBlock,
  renderSession,
} from '../../src/runtime/render.js';

describe('escapeScString', () => {
  it('escapes backslashes and quotes', () => {
    expect(escapeScString(String.raw`C:\tmp"a.wav`)).toBe(String.raw`C:\\tmp\"a.wav`);
  });
});

describe('buildRenderBlock', () => {
  it('wraps user code with boot and record', () => {
    const block = buildRenderBlock('{ SinOsc.ar(440) }.play;', '/tmp/out.wav');
    expect(block).toContain('s.boot');
    expect(block).toContain('{ SinOsc.ar(440) }.play;');
    expect(block).toContain('s.prepareForRecord("/tmp/out.wav")');
    expect(block).toContain('s.record');
  });
});

describe('renderSession', () => {
  const outPath = path.resolve('tests/runtime/fixture-render-out.wav');

  afterEach(() => {
    if (fs.existsSync(outPath)) {
      fs.unlinkSync(outPath);
    }
    vi.useRealTimers();
  });

  it('records and returns bytes when execute succeeds', async () => {
    vi.useFakeTimers();
    fs.writeFileSync(outPath, Buffer.alloc(128));

    const controller = {
      boot: vi.fn().mockResolvedValue(undefined),
      execute: vi
        .fn()
        .mockResolvedValueOnce({ success: true, output: 'start ok' })
        .mockResolvedValueOnce({ success: true, output: 'stop ok' }),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const promise = renderSession(controller as any, {
      userCode: '{ SinOsc.ar(440) }.play;',
      outPath,
      durationSec: 0.01,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(controller.boot).toHaveBeenCalled();
    expect(controller.execute).toHaveBeenCalledTimes(2);
    expect(controller.stop).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.bytes).toBe(128);
    expect(result.outPath).toBe(outPath);
  });

  it('stops and returns failure when initial execute fails', async () => {
    const controller = {
      boot: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({ success: false, output: 'boot failed' }),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    const result = await renderSession(controller as any, {
      userCode: 'bad',
      outPath,
      durationSec: 1,
    });

    expect(controller.stop).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.bytes).toBe(0);
  });
});
