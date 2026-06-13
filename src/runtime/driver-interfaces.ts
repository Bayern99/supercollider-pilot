import {
  RunScriptOptions,
  ScriptRunResult,
  SclangControllerOptions,
} from './sclang.js';

export interface SclangControllerLike {
  boot(): Promise<void>;
  clearUnexpectedExitError(): void;
  getLogs(): string;
  getLogsTail(tail: number): string;
  getUnexpectedExitError(): Error | null;
  hasProcess(): boolean;
  isBusy(): boolean;
  runScript(script: string, options: RunScriptOptions): Promise<ScriptRunResult>;
  stop(): Promise<void>;
}

export interface DriverOptions {
  createController?: (
    sclangPath: string,
    options?: SclangControllerOptions,
  ) => SclangControllerLike;
  detectCapabilities?: (
    sclangPath: string | null,
  ) => import('./driver-types.js').RuntimeCapabilities;
  discoverPath?: () => string | null;
  executeTimeoutMs?: number;
  runNrtRender?: typeof import('./render-nrt.js').runNrtRender;
  sleep?: (ms: number) => Promise<void>;
}
