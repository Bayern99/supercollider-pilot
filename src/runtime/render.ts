import fs from 'fs';
import { SclangController } from './sclang.js';

export function escapeScString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildRenderBlock(userCode: string, outPath: string): string {
  const escapedOut = escapeScString(outPath);
  return (
    's.boot;\n' +
    's.sync;\n' +
    userCode +
    '\n' +
    's.prepareForRecord("' +
    escapedOut +
    '");\n' +
    's.sync;\n' +
    's.record;\n' +
    's.sync;\n'
  );
}

export interface RenderOptions {
  userCode: string;
  outPath: string;
  durationSec?: number;
}

export interface RenderResult {
  success: boolean;
  output: string;
  outPath: string;
  bytes: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function renderSession(
  controller: SclangController,
  options: RenderOptions,
): Promise<RenderResult> {
  const durationSec = options.durationSec ?? 5;
  await controller.boot();
  const start = await controller.execute(buildRenderBlock(options.userCode, options.outPath));
  if (!start.success) {
    await controller.stop();
    return { success: false, output: start.output, outPath: options.outPath, bytes: 0 };
  }
  await sleep(durationSec * 1000);
  const stopRec = await controller.execute('s.stopRecording;\ns.sync;\n');
  await controller.stop();
  const bytes = fs.existsSync(options.outPath) ? fs.statSync(options.outPath).size : 0;
  const success = stopRec.success && bytes > 0;
  return {
    success,
    output: start.output + '\n' + stopRec.output,
    outPath: options.outPath,
    bytes,
  };
}
