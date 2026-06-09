import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readScdFile } from '../../src/runtime/sc-file.js';

describe('readScdFile', () => {
  const p = path.resolve('tests/runtime/fixture-temp.scd');

  afterEach(() => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  it('reads existing .scd file', () => {
    fs.writeFileSync(p, '{ SinOsc.ar(440) }.play;');
    expect(readScdFile(p)).toBe('{ SinOsc.ar(440) }.play;');
  });

  it('throws when file missing', () => {
    expect(() => readScdFile('/nonexistent/file.scd')).toThrow(/not found/i);
  });

  it('throws when path is directory', () => {
    expect(() => readScdFile(path.resolve('tests/runtime'))).toThrow(/not a regular file/i);
  });
});
