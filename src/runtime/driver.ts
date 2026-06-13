import { detectRuntimeCapabilities } from './capabilities.js';
import { discoverSclangPath } from './discover.js';
import {
  DriverOptions,
  SclangControllerLike,
} from './driver-interfaces.js';
import {
  EngineKind,
  EnginePreference,
  DriverErrorKind,
  DriverResult,
  DriverState,
  HealthSnapshot,
  RequestedSampleFormat,
  RenderArtifact,
  RuntimeCapabilities,
  SessionSnapshot,
} from './driver-types.js';
import {
  buildEvalScript,
  buildPingScript,
  buildResetScript,
  buildServerRunningScript,
  containsScRuntimeError,
  makeMarker,
} from './protocol.js';
import { runNrtRenderCommand } from './render-nrt-driver.js';
import { runNrtRender } from './render-nrt.js';
import { runDraftRender } from './render-draft.js';
import {
  buildEvalLikeResult,
  ensureReadyController,
  SessionLifecycleHost,
  stopAndClearController,
} from './session-lifecycle.js';
import {
  SclangController,
  SclangControllerOptions,
} from './sclang.js';

export type { SclangControllerLike, DriverOptions } from './driver-interfaces.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ScDriver implements SessionLifecycleHost {
  private controller: SclangControllerLike | null = null;
  private readonly createControllerFn;
  private readonly discoverPathFn;
  private readonly executeTimeoutMsValue: number;
  private readonly detectCapabilitiesFn;
  public get runNrt(): typeof runNrtRender {
    return this.runNrtFn;
  }

  private readonly runNrtFn;
  private readonly sleepFn;
  private state: DriverState = 'idle';
  private phase = 'idle';
  private sessionId: string | null = null;
  private lastErrorKind: DriverErrorKind | null = null;

  constructor(options: DriverOptions = {}) {
    this.createControllerFn =
      options.createController ??
      ((sclangPath: string, controllerOptions?: SclangControllerOptions) =>
        new SclangController(sclangPath, controllerOptions));
    this.detectCapabilitiesFn = options.detectCapabilities ?? detectRuntimeCapabilities;
    this.discoverPathFn = options.discoverPath ?? (() => discoverSclangPath());
    this.executeTimeoutMsValue = options.executeTimeoutMs ?? 120_000;
    this.runNrtFn = options.runNrtRender ?? runNrtRender;
    this.sleepFn = options.sleep ?? sleep;
  }

  public get executeTimeoutMs(): number {
    return this.executeTimeoutMsValue;
  }

  public createController(sclangPath: string): SclangControllerLike {
    return this.createControllerFn(sclangPath, {
      executeTimeoutMs: this.executeTimeoutMsValue,
    });
  }

  public discoverPath(): string | null {
    return this.discoverPathFn();
  }

  public getController(): SclangControllerLike | null {
    return this.controller;
  }

  public setController(controller: SclangControllerLike | null): void {
    this.controller = controller;
  }

  public getState(): DriverState {
    return this.state;
  }

  public setState(state: DriverState): void {
    this.state = state;
  }

  public getPhase(): string {
    return this.phase;
  }

  public setPhase(phase: string): void {
    this.phase = phase;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  public getLastErrorKind(): DriverErrorKind | null {
    return this.lastErrorKind;
  }

  public setLastErrorKind(errorKind: DriverErrorKind | null): void {
    this.lastErrorKind = errorKind;
  }

  public sleepMs(ms: number): Promise<void> {
    return this.sleepFn(ms);
  }

  public async check(): Promise<DriverResult> {
    const sclangPath = this.discoverPath();
    const capabilities = this.getCapabilities(sclangPath);
    if (!sclangPath) {
      return this.buildErrorResult('check', 'engine_missing', 'engine_missing', false, '', {
        capabilities,
        summary: 'SuperCollider engine is not installed or not discoverable.',
      });
    }

    if (this.controller) {
      return this.buildSuccessResult('check', this.state, '', {
        capabilities,
        summary: 'Engine is available and an active session is present.',
        session: this.snapshot(sclangPath),
      });
    }

    const probeController = this.createControllerFn(sclangPath, {
      executeTimeoutMs: this.executeTimeoutMsValue,
    });

    try {
      await probeController.boot();
      const doneMarker = makeMarker('check_ping');
      const probe = await probeController.runScript(buildPingScript(doneMarker), {
        completionMarkers: [doneMarker],
        timeoutMs: this.executeTimeoutMsValue,
      });

      return this.buildSuccessResult('check', this.state, probe.rawOutput, {
        capabilities,
        summary: 'SuperCollider engine is reachable.',
        session: this.snapshot(sclangPath),
      });
    } catch (err: any) {
      return this.buildErrorResult('check', 'degraded', 'protocol_error', true, '', {
        capabilities,
        summary: `Engine was found but interpreter ping failed: ${err.message}`,
      });
    } finally {
      await probeController.stop();
    }
  }

  public async status(): Promise<DriverResult> {
    const sclangPath = this.discoverPath();
    const degradedReason = this.getDegradedReason();
    if (degradedReason) {
      this.state = 'degraded';
      return this.buildErrorResult('status', 'degraded', 'process_exit', true, '', {
        summary: degradedReason,
        session: this.snapshot(sclangPath),
      });
    }

    return this.buildSuccessResult('status', this.state, '', {
      summary: this.controller
        ? 'An active driver session is present.'
        : 'No active driver session is present.',
      session: this.snapshot(sclangPath),
    });
  }

  public async health(): Promise<DriverResult> {
    const sclangPath = this.discoverPath();
    const capabilities = this.getCapabilities(sclangPath);
    if (!sclangPath) {
      return this.buildErrorResult('health', 'engine_missing', 'engine_missing', false, '', {
        capabilities,
        summary: 'SuperCollider engine is not installed or not discoverable.',
        health: this.buildHealthSnapshot(null, false, false, 'Engine path not found'),
      });
    }

    if (!this.controller) {
      return this.buildSuccessResult('health', this.state, '', {
        capabilities,
        summary: 'Engine is available and there is no active session.',
        health: this.buildHealthSnapshot(sclangPath, false, false, null),
      });
    }

    const degradedReason = this.getDegradedReason();
    if (degradedReason) {
      this.state = 'degraded';
      return this.buildErrorResult('health', 'degraded', 'process_exit', true, '', {
        capabilities,
        summary: degradedReason,
        health: this.buildHealthSnapshot(sclangPath, false, false, degradedReason),
      });
    }

    if (this.controller.isBusy()) {
      this.state = 'busy';
      return this.buildSuccessResult('health', 'busy', '', {
        capabilities,
        summary: 'Session is busy; returning the last known health snapshot.',
        health: this.buildHealthSnapshot(sclangPath, this.controller.hasProcess(), true, null),
      });
    }

    const readyMarker = makeMarker('health_ready');
    const notReadyMarker = makeMarker('health_not_ready');

    try {
      const probe = await this.controller.runScript(
        buildServerRunningScript(readyMarker, notReadyMarker),
        {
          completionMarkers: [readyMarker, notReadyMarker],
          timeoutMs: this.executeTimeoutMsValue,
        },
      );

      if (probe.matchedMarker === readyMarker) {
        this.state = 'ready';
        this.phase = 'health';
        return this.buildSuccessResult('health', 'ready', probe.rawOutput, {
          capabilities,
          summary: 'Session is healthy and ready.',
          health: this.buildHealthSnapshot(sclangPath, true, true, null),
        });
      }

      this.state = 'degraded';
      this.lastErrorKind = 'server_not_ready';
      return this.buildErrorResult(
        'health',
        'degraded',
        'server_not_ready',
        true,
        probe.rawOutput,
        {
          capabilities,
          summary: 'The active session is alive but the SuperCollider server is not ready.',
          health: this.buildHealthSnapshot(
            sclangPath,
            true,
            false,
            'Server reported not ready',
          ),
        },
      );
    } catch (err: any) {
      this.state = 'degraded';
      this.lastErrorKind = 'protocol_error';
      return this.buildErrorResult('health', 'degraded', 'protocol_error', true, '', {
        capabilities,
        summary: `Health probe failed: ${err.message}`,
        health: this.buildHealthSnapshot(
          sclangPath,
          this.controller.hasProcess(),
          false,
          err.message,
        ),
      });
    }
  }

  public async eval(code: string): Promise<DriverResult> {
    if (!code.trim()) {
      return this.buildErrorResult('eval', this.state, 'invalid_argument', false, '', {
        summary: 'Evaluation code must not be empty.',
      });
    }

    const ready = await ensureReadyController(this, 'eval');
    if ('success' in ready) {
      return ready;
    }

    this.state = 'busy';
    this.phase = 'eval';

    const doneMarker = makeMarker('eval_done');
    try {
      const result = await ready.controller.runScript(buildEvalScript(code, doneMarker), {
        completionMarkers: [doneMarker],
        timeoutMs: this.executeTimeoutMsValue,
      });

      return buildEvalLikeResult(this, 'eval', ready.rawOutput, result.rawOutput);
    } catch (err: any) {
      this.state = 'degraded';
      this.lastErrorKind = 'protocol_error';
      return this.buildErrorResult('eval', 'degraded', 'protocol_error', true, ready.rawOutput, {
        summary: `Evaluation protocol failed: ${err.message}`,
      });
    }
  }

  public async runFile(filePath: string, readFile: (path: string) => string): Promise<DriverResult> {
    if (!filePath.trim()) {
      return this.buildErrorResult('run_file', this.state, 'invalid_argument', false, '', {
        summary: 'A .scd file path is required.',
      });
    }

    let userCode: string;
    try {
      userCode = readFile(filePath);
    } catch (err: any) {
      return this.buildErrorResult('run_file', this.state, 'invalid_argument', false, '', {
        summary: err.message,
      });
    }

    const ready = await ensureReadyController(this, 'run_file');
    if ('success' in ready) {
      return ready;
    }

    this.state = 'busy';
    this.phase = 'run_file';

    const doneMarker = makeMarker('run_file_done');
    try {
      const result = await ready.controller.runScript(buildEvalScript(userCode, doneMarker), {
        completionMarkers: [doneMarker],
        timeoutMs: this.executeTimeoutMsValue,
      });

      return buildEvalLikeResult(this, 'run_file', ready.rawOutput, result.rawOutput);
    } catch (err: any) {
      this.state = 'degraded';
      this.lastErrorKind = 'protocol_error';
      return this.buildErrorResult(
        'run_file',
        'degraded',
        'protocol_error',
        true,
        ready.rawOutput,
        {
          summary: `File execution protocol failed: ${err.message}`,
        },
      );
    }
  }

  public async logs(tail?: number): Promise<DriverResult> {
    if (!this.controller) {
      return this.buildErrorResult('logs', this.state, 'session_missing', true, '', {
        summary: 'No active session is available for log inspection.',
      });
    }

    const output =
      typeof tail === 'number' && tail > 0
        ? this.controller.getLogsTail(tail)
        : this.controller.getLogs();

    return this.buildSuccessResult('logs', this.state, output, {
      summary: 'Returning the requested log buffer slice.',
      session: this.snapshot(this.discoverPath()),
    });
  }

  public async render(options: {
    durationSec?: number;
    outPath: string;
    userCode: string;
  }): Promise<DriverResult<RenderArtifact>> {
    return runDraftRender(this, options);
  }

  public async renderNrt(options: {
    durationSec?: number;
    enginePreference?: EnginePreference;
    outPath: string;
    sampleFormat?: RequestedSampleFormat;
    sourcePath: string;
  }): Promise<DriverResult<RenderArtifact>> {
    return runNrtRenderCommand(this, options);
  }

  public async stop(): Promise<DriverResult> {
    if (!this.controller) {
      this.state = 'stopped';
      this.phase = 'stop';
      return this.buildSuccessResult('stop', 'stopped', '', {
        summary: 'No active session was running.',
      });
    }

    this.state = 'stopping';
    this.phase = 'stop';

    try {
      await stopAndClearController(this, false);
      return this.buildSuccessResult('stop', 'stopped', '', {
        summary: 'The active session was stopped cleanly.',
      });
    } catch (err: any) {
      this.state = 'degraded';
      this.lastErrorKind = 'cleanup_failed';
      return this.buildErrorResult('stop', 'degraded', 'cleanup_failed', true, '', {
        summary: `Stopping the active session failed: ${err.message}`,
      });
    }
  }

  public async reset(): Promise<DriverResult> {
    if (!this.controller) {
      return this.buildSuccessResult('reset', this.state, '', {
        summary: 'No active session was present, so there was nothing to reset.',
      });
    }
    if (this.controller.isBusy()) {
      return this.buildErrorResult('reset', 'busy', 'session_conflict', true, '', {
        summary: 'The active session is busy and cannot be reset right now.',
      });
    }

    const ready = await ensureReadyController(this, 'reset');
    if ('success' in ready) {
      return ready;
    }

    const doneMarker = makeMarker('reset_done');
    this.state = 'busy';
    this.phase = 'reset';

    try {
      const result = await ready.controller.runScript(buildResetScript(doneMarker), {
        completionMarkers: [doneMarker],
        timeoutMs: this.executeTimeoutMsValue,
      });
      const output = this.mergeOutput(ready.rawOutput, result.rawOutput);
      if (containsScRuntimeError(output)) {
        this.state = 'degraded';
        this.lastErrorKind = 'cleanup_failed';
        return this.buildErrorResult('reset', 'degraded', 'cleanup_failed', true, output, {
          summary: 'Reset finished with SuperCollider-side cleanup errors.',
        });
      }

      this.state = 'ready';
      this.lastErrorKind = null;
      return this.buildSuccessResult('reset', 'ready', output, {
        summary: 'The active session was cleaned and is ready for more work.',
      });
    } catch (err: any) {
      this.state = 'degraded';
      this.lastErrorKind = 'cleanup_failed';
      return this.buildErrorResult('reset', 'degraded', 'cleanup_failed', true, ready.rawOutput, {
        summary: `Reset failed: ${err.message}`,
      });
    }
  }

  public async reboot(): Promise<DriverResult> {
    if (this.controller?.isBusy()) {
      return this.buildErrorResult('reboot', 'busy', 'session_conflict', true, '', {
        summary: 'The active session is busy and cannot be rebooted right now.',
      });
    }

    try {
      await stopAndClearController(this, false);
    } catch (err: any) {
      this.state = 'degraded';
      this.lastErrorKind = 'cleanup_failed';
      return this.buildErrorResult('reboot', 'degraded', 'cleanup_failed', true, '', {
        summary: `Graceful reboot cleanup failed: ${err.message}`,
      });
    }

    const ready = await ensureReadyController(this, 'reboot');
    if ('success' in ready) {
      return ready;
    }

    this.state = 'ready';
    this.lastErrorKind = null;
    return this.buildSuccessResult('reboot', 'ready', ready.rawOutput, {
      summary: 'A fresh session was created and the SuperCollider server is ready.',
    });
  }

  public async reclaim(): Promise<DriverResult> {
    await stopAndClearController(this, true);

    const ready = await ensureReadyController(this, 'reclaim');
    if ('success' in ready) {
      return ready;
    }

    this.state = 'ready';
    this.lastErrorKind = null;
    return this.buildSuccessResult('reclaim', 'ready', ready.rawOutput, {
      summary: 'The local driver session was reclaimed and reinitialized.',
    });
  }

  public buildSuccessResult<TArtifact>(
    phase: string,
    state: DriverState,
    rawOutput: string,
    extras: {
      artifact?: TArtifact;
      capabilities?: RuntimeCapabilities;
      health?: HealthSnapshot;
      session?: SessionSnapshot;
      summary: string;
    },
  ): DriverResult<TArtifact> {
    this.phase = phase;
    return {
      success: true,
      state,
      phase,
      session_id: this.sessionId,
      recoverable: state !== 'engine_missing',
      error_kind: null,
      summary: extras.summary,
      raw_output: rawOutput,
      artifact: extras.artifact,
      capabilities: extras.capabilities,
      health: extras.health,
      session: extras.session ?? this.snapshot(this.discoverPath()),
    };
  }

  public buildErrorResult<TArtifact>(
    phase: string,
    state: DriverState,
    errorKind: DriverErrorKind,
    recoverable: boolean,
    rawOutput: string,
    extras: {
      artifact?: TArtifact;
      capabilities?: RuntimeCapabilities;
      health?: HealthSnapshot;
      session?: SessionSnapshot;
      summary: string;
    },
  ): DriverResult<TArtifact> {
    this.phase = phase;
    this.lastErrorKind = errorKind;
    return {
      success: false,
      state,
      phase,
      session_id: this.sessionId,
      recoverable,
      error_kind: errorKind,
      summary: extras.summary,
      raw_output: rawOutput,
      artifact: extras.artifact,
      capabilities: extras.capabilities,
      health: extras.health,
      session: extras.session ?? this.snapshot(this.discoverPath()),
    };
  }

  public getDegradedReason(): string | null {
    const exitError = this.controller?.getUnexpectedExitError();
    if (!exitError) {
      return null;
    }
    return `The active session exited unexpectedly: ${exitError.message}`;
  }

  public mergeOutput(...chunks: string[]): string {
    return chunks.filter(Boolean).join('\n').trim();
  }

  public snapshot(enginePath: string | null): SessionSnapshot {
    return {
      state: this.state,
      phase: this.phase,
      session_id: this.sessionId,
      engine_path: enginePath,
      has_controller: this.controller !== null,
      busy: this.controller?.isBusy() ?? false,
      last_error_kind: this.lastErrorKind,
      recoverable: this.state !== 'engine_missing',
    };
  }

  private buildHealthSnapshot(
    enginePath: string | null,
    processAlive: boolean,
    serverReady: boolean,
    degradedReason: string | null,
  ): HealthSnapshot {
    return {
      ...this.snapshot(enginePath),
      process_alive: processAlive,
      server_ready: serverReady,
      log_bytes: this.controller?.getLogs().length ?? 0,
      degraded_reason: degradedReason,
    };
  }

  public getCapabilities(sclangPath: string | null): RuntimeCapabilities {
    return this.detectCapabilitiesFn(sclangPath);
  }

  public resolveNrtEngine(
    preference: EnginePreference,
    capabilities: RuntimeCapabilities,
  ): { kind: EngineKind; path: string } | null {
    if (preference === 'supernova') {
      return capabilities.supernova.available && capabilities.supernova.path
        ? { kind: 'supernova', path: capabilities.supernova.path }
        : null;
    }

    if (capabilities.scsynth.available && capabilities.scsynth.path) {
      return { kind: 'scsynth', path: capabilities.scsynth.path };
    }

    return null;
  }
}
