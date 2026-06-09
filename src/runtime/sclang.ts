import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

export interface SclangControllerOptions {
  executeTimeoutMs?: number;
  maxLogBytes?: number;
}

const DEFAULT_EXECUTE_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_LOG_BYTES = 512_000;

function wrapScCode(code: string, delim: string): string {
  const body = code.trimEnd().replace(/;\s*$/, '');
  return (
    'fork {\n' +
    '  try {\n' +
    body + ';\n' +
    '    "\\n' + delim + '_OK".postln;\n' +
    '  } { |error|\n' +
    '    "\\n' + delim + '_ERR".postln;\n' +
    '    error.reportError;\n' +
    '  };\n' +
    '};\n'
  );
}

export class SclangController {
  private process: ChildProcessWithoutNullStreams | null = null;
  private path: string;
  private outputBuffer: string = '';
  private isExecuting: boolean = false;
  private executeTimeoutMs: number;
  private maxLogBytes: number;

  private bootPromise: Promise<void> | null = null;
  private bootResolve: (() => void) | null = null;
  private bootReject: ((err: Error) => void) | null = null;
  private bootTimeout: NodeJS.Timeout | null = null;

  private activeExecuteReject: ((err: Error) => void) | null = null;

  constructor(sclangPath: string, options: SclangControllerOptions = {}) {
    this.path = sclangPath;
    this.executeTimeoutMs = options.executeTimeoutMs ?? DEFAULT_EXECUTE_TIMEOUT_MS;
    this.maxLogBytes = options.maxLogBytes ?? DEFAULT_MAX_LOG_BYTES;
  }

  public boot(): Promise<void> {
    if (this.bootPromise) {
      return this.bootPromise;
    }
    if (this.process) {
      return Promise.resolve();
    }

    this.bootPromise = new Promise((resolve, reject) => {
      try {
        this.bootResolve = resolve;
        this.bootReject = reject;

        const cp = spawn(this.path, ['-i', 'scide']);
        this.process = cp;

        cp.stdin.on('error', () => {});

        cp.stdout.on('data', (data) => {
          this.appendLog(data.toString());
        });

        cp.stderr.on('data', (data) => {
          this.appendLog(data.toString());
        });

        cp.on('error', (err) => {
          if (this.bootReject) {
            this.bootReject(err);
            this.bootReject = null;
            this.bootResolve = null;
          }
          if (this.bootTimeout) {
            clearTimeout(this.bootTimeout);
            this.bootTimeout = null;
          }
          this.bootPromise = null;
          this.cleanupProcess();
        });

        cp.on('exit', (code, signal) => {
          const exitErr = new Error(`sclang process exited unexpectedly with code ${code} and signal ${signal}`);

          if (this.bootReject) {
            this.bootReject(exitErr);
            this.bootReject = null;
            this.bootResolve = null;
          }
          if (this.bootTimeout) {
            clearTimeout(this.bootTimeout);
            this.bootTimeout = null;
          }

          if (this.activeExecuteReject) {
            this.activeExecuteReject(exitErr);
            this.activeExecuteReject = null;
          }

          this.bootPromise = null;
          this.cleanupProcess();
        });

        this.bootTimeout = setTimeout(() => {
          this.bootTimeout = null;
          if (this.bootResolve) {
            this.bootResolve();
            this.bootResolve = null;
            this.bootReject = null;
          }
          this.bootPromise = null;
        }, 1500);
      } catch (err: any) {
        this.bootPromise = null;
        reject(err);
        this.bootResolve = null;
        this.bootReject = null;
      }
    });

    return this.bootPromise;
  }

  public async execute(code: string): Promise<{ success: boolean; output: string }> {
    if (!this.process) {
      throw new Error('sclang is not booted. Call boot() first.');
    }

    if (this.isExecuting) {
      throw new Error('Concurrent execution is not supported');
    }

    this.isExecuting = true;

    const delim = 'SC_EVAL_DONE_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const wrappedCode = wrapScCode(code, delim);

    return new Promise<{ success: boolean; output: string }>((resolve, reject) => {
      this.activeExecuteReject = reject;
      let runBuffer = '';

      const dataHandler = (data: Buffer) => {
        const chunk = data.toString();
        runBuffer += chunk;
        this.appendLog(chunk);

        if (runBuffer.includes(`${delim}_OK`)) {
          finish();
          this.isExecuting = false;
          this.activeExecuteReject = null;
          resolve({
            success: true,
            output: runBuffer.replace(`${delim}_OK`, '').trim(),
          });
        } else if (runBuffer.includes(`${delim}_ERR`)) {
          finish();
          this.isExecuting = false;
          this.activeExecuteReject = null;
          resolve({
            success: false,
            output: runBuffer.replace(`${delim}_ERR`, '').trim(),
          });
        }
      };

      const finish = () => {
        this.process?.stdout.removeListener('data', dataHandler);
        this.process?.stderr.removeListener('data', dataHandler);
        clearTimeout(executeTimeout);
      };

      const executeTimeout = setTimeout(() => {
        finish();
        this.isExecuting = false;
        this.activeExecuteReject = null;
        reject(new Error(`Execution timed out after ${this.executeTimeoutMs}ms`));
      }, this.executeTimeoutMs);

      this.process!.stdout.on('data', dataHandler);
      this.process!.stderr.on('data', dataHandler);

      try {
        this.process!.stdin.write(wrappedCode + '\x0c');
      } catch (err: any) {
        finish();
        this.isExecuting = false;
        this.activeExecuteReject = null;
        reject(err);
      }
    });
  }

  public getLogs(): string {
    return this.outputBuffer;
  }

  public stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      const cp = this.process;
      if (!cp) {
        resolve();
        return;
      }

      if (this.activeExecuteReject) {
        const rejectExecute = this.activeExecuteReject;
        this.activeExecuteReject = null;
        this.isExecuting = false;
        rejectExecute(new Error('Controller stopped'));
      }

      const onExit = () => {
        cleanup();
        this.cleanupProcess();
        resolve();
      };

      const cleanup = () => {
        cp.removeListener('exit', onExit);
        cp.removeListener('close', onExit);
        clearTimeout(killTimeout);
      };

      cp.on('exit', onExit);
      cp.on('close', onExit);

      const killTimeout = setTimeout(() => {
        try {
          cp.kill('SIGKILL');
        } catch {
          // Ignore
        }
        onExit();
      }, 500);

      try {
        cp.stdin.write('CmdPeriod.run; Server.killAll;\n\x0c');
        cp.stdin.end();
      } catch {
        try {
          cp.kill('SIGKILL');
        } catch {
          // Ignore
        }
        onExit();
      }
    });
  }

  private appendLog(chunk: string): void {
    this.outputBuffer += chunk;
    if (this.outputBuffer.length > this.maxLogBytes) {
      this.outputBuffer = this.outputBuffer.slice(-this.maxLogBytes);
    }
  }

  private cleanupProcess(): void {
    if (this.process) {
      this.process.removeAllListeners();
      this.process.stdout.removeAllListeners();
      this.process.stderr.removeAllListeners();
      this.process.stdin.removeAllListeners();
      this.process = null;
    }
    this.isExecuting = false;
  }
}
