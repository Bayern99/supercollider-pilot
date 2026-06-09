#!/usr/bin/env node
import { Command } from 'commander';
import { discoverSclangPath } from './runtime/discover.js';
import { readScdFile } from './runtime/sc-file.js';
import { renderSession } from './runtime/render.js';
import { probeServerWithNewController } from './runtime/server-probe.js';
import { SclangController } from './runtime/sclang.js';

const program = new Command();

program
  .name('scctl')
  .description('SuperCollider Coding Agent Control CLI')
  .version('1.0.0');

program
  .command('check')
  .description('Check SuperCollider installation path')
  .action(async () => {
    const sclangPath = discoverSclangPath();
    if (!sclangPath) {
      console.log('STATUS: ERROR');
      console.error('Error: sclang binary not found');
      process.exit(1);
    }
    const serverStatus = await probeServerWithNewController(sclangPath);
    console.log('STATUS: OK');
    console.log(`PATH: ${sclangPath}`);
    console.log(`SERVER: ${serverStatus}`);
  });

program
  .command('run <file>')
  .description('Run a .scd file and evaluate it using SclangController')
  .option('--tail-logs <n>', 'Print last N log characters on failure', parsePositiveInt)
  .action(async (file, options: { tailLogs?: number }) => {
    let controller: SclangController | null = null;
    try {
      const code = readScdFile(file);
      const sclangPath = discoverSclangPath();
      if (!sclangPath) {
        console.error('Error: sclang binary not found');
        process.exit(1);
      }
      controller = new SclangController(sclangPath);
      await controller.boot();
      const result = await controller.execute(code);
      if (result.success) {
        console.log(result.output);
        await controller.stop();
        process.exit(0);
      }
      if (options.tailLogs) {
        const logs = controller.getLogs();
        const tail = logs.slice(-options.tailLogs);
        if (tail) {
          console.error('--- logs (tail) ---');
          console.error(tail);
        }
      }
      console.error(result.output);
      await controller.stop();
      process.exit(1);
    } catch (err: any) {
      console.error(`Execution failed: ${err.message}`);
      if (controller) {
        await controller.stop();
      }
      process.exit(1);
    }
  });

program
  .command('render <file>')
  .description('Record a .scd file to a WAV using the R1 render wrapper')
  .requiredOption('-o, --out <path>', 'Output WAV path')
  .option('-d, --duration <seconds>', 'Record duration in seconds', '5')
  .option('--tail-logs <n>', 'Print last N log characters on failure', parsePositiveInt)
  .action(async (file, options: { out: string; duration: string; tailLogs?: number }) => {
    let controller: SclangController | null = null;
    try {
      const userCode = readScdFile(file);
      const sclangPath = discoverSclangPath();
      if (!sclangPath) {
        console.error('Error: sclang binary not found');
        process.exit(1);
      }
      const durationSec = parseFloat(options.duration);
      if (!Number.isFinite(durationSec) || durationSec <= 0) {
        console.error('Error: duration must be a positive number');
        process.exit(1);
      }
      controller = new SclangController(sclangPath);
      const result = await renderSession(controller, {
        userCode,
        outPath: options.out,
        durationSec,
      });
      if (result.success) {
        console.log(`WAV: ${result.outPath} (${result.bytes} bytes)`);
        if (result.output.trim()) {
          console.log(result.output);
        }
        process.exit(0);
      }
      if (options.tailLogs && controller) {
        const logs = controller.getLogs();
        const tail = logs.slice(-options.tailLogs);
        if (tail) {
          console.error('--- logs (tail) ---');
          console.error(tail);
        }
      }
      console.error(result.output);
      console.error(`WAV: ${result.outPath} (${result.bytes} bytes)`);
      process.exit(1);
    } catch (err: any) {
      console.error(`Execution failed: ${err.message}`);
      if (controller) {
        await controller.stop();
      }
      process.exit(1);
    }
  });

function parsePositiveInt(value: string): number {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Value must be a positive integer');
  }
  return n;
}

await program.parseAsync(process.argv);
