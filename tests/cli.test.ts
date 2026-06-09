import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('CLI Shell Interface', () => {
  beforeAll(() => {
    execSync('npm run build');
  }, 15000);

  it('should compile and support CLI options', () => {
    const stdout = execSync('node ./dist/cli.js --help').toString();
    expect(stdout).toContain('scctl');
  });

  it('should support check command', () => {
    let stdout = '';
    try {
      stdout = execSync('node ./dist/cli.js check').toString();
    } catch (err: any) {
      stdout = err.stdout ? err.stdout.toString() : '';
    }
    expect(stdout).toMatch(/STATUS: (OK|ERROR)/);
    if (stdout.includes('STATUS: OK')) {
      expect(stdout).toMatch(/SERVER: (running|not_running|unknown)/);
    }
  });

  it('should support render command in help', () => {
    const stdout = execSync('node ./dist/cli.js --help').toString();
    expect(stdout).toContain('render');
  });

  it('should expose render options', () => {
    const stdout = execSync('node ./dist/cli.js render --help').toString();
    expect(stdout).toContain('-o');
    expect(stdout).toContain('--duration');
  });

  it('should expose run options', () => {
    const stdout = execSync('node ./dist/cli.js run --help').toString();
    expect(stdout).toContain('--tail-logs');
  });

  it('should fail render when sclang is missing', () => {
    let checkStdout = '';
    try {
      checkStdout = execSync('node ./dist/cli.js check').toString();
    } catch (err: any) {
      checkStdout = err.stdout ? err.stdout.toString() : '';
    }

    if (checkStdout.includes('STATUS: OK')) {
      return;
    }

    const tempFile = path.resolve('temp_test_render.scd');
    fs.writeFileSync(tempFile, '{ SinOsc.ar(440) }.play;');
    try {
      expect(() => {
        execSync(`node ./dist/cli.js render "${tempFile}" -o /tmp/out.wav`);
      }).toThrow();
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });
});
