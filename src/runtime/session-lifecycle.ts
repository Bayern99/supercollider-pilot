import {
  buildWaitForBootScript,
  containsScRuntimeError,
  makeMarker,
} from './protocol.js';
import {
  DriverErrorKind,
  DriverResult,
  DriverState,
  SessionSnapshot,
} from './driver-types.js';
import type { SclangControllerLike } from './driver-interfaces.js';

export interface ReadyControllerResult {
  controller: SclangControllerLike;
  rawOutput: string;
}

export interface SessionLifecycleHost {
  createController(sclangPath: string): SclangControllerLike;
  discoverPath(): string | null;
  executeTimeoutMs: number;
  getController(): SclangControllerLike | null;
  getDegradedReason(): string | null;
  getLastErrorKind(): DriverErrorKind | null;
  getPhase(): string;
  getSessionId(): string | null;
  getState(): DriverState;
  mergeOutput(...chunks: string[]): string;
  setController(controller: SclangControllerLike | null): void;
  setLastErrorKind(errorKind: DriverErrorKind | null): void;
  setPhase(phase: string): void;
  setSessionId(sessionId: string | null): void;
  setState(state: DriverState): void;
  sleepMs(ms: number): Promise<void>;
  snapshot(enginePath: string | null): SessionSnapshot;
  buildErrorResult<TArtifact>(
    phase: string,
    state: DriverState,
    errorKind: DriverErrorKind,
    recoverable: boolean,
    rawOutput: string,
    extras: {
      artifact?: TArtifact;
      summary: string;
    },
  ): DriverResult<TArtifact>;
  buildSuccessResult<TArtifact>(
    phase: string,
    state: DriverState,
    rawOutput: string,
    extras: {
      artifact?: TArtifact;
      summary: string;
    },
  ): DriverResult<TArtifact>;
}

export function createSessionId(): string {
  return `scctl-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

export async function ensureReadyController(
  host: SessionLifecycleHost,
  phase: string,
): Promise<DriverResult | ReadyControllerResult> {
  const sclangPath = host.discoverPath();
  if (!sclangPath) {
    host.setState('engine_missing');
    host.setLastErrorKind('engine_missing');
    return host.buildErrorResult(phase, 'engine_missing', 'engine_missing', false, '', {
      summary: 'SuperCollider engine is not installed or not discoverable.',
    });
  }

  const degradedReason = host.getDegradedReason();
  if (degradedReason) {
    host.setState('degraded');
    host.setLastErrorKind('process_exit');
    return host.buildErrorResult(phase, 'degraded', 'process_exit', true, '', {
      summary: degradedReason,
    });
  }

  const controller = host.getController();
  if (controller?.isBusy()) {
    host.setState('busy');
    return host.buildErrorResult(phase, 'busy', 'session_conflict', true, '', {
      summary: 'The active session is already executing another action.',
    });
  }

  if (!controller) {
    host.setController(host.createController(sclangPath));
    host.setSessionId(createSessionId());
  }

  host.setState('booting');
  host.setPhase(phase);

  const activeController = host.getController()!;

  try {
    await activeController.boot();
  } catch (err: any) {
    host.setState('degraded');
    host.setLastErrorKind('protocol_error');
    return host.buildErrorResult(phase, 'degraded', 'protocol_error', true, '', {
      summary: `Failed to boot the sclang interpreter: ${err.message}`,
    });
  }

  const doneMarker = makeMarker(`${phase}_boot_ready`);
  try {
    const bootReady = await activeController.runScript(buildWaitForBootScript(doneMarker), {
      completionMarkers: [doneMarker],
      timeoutMs: host.executeTimeoutMs,
    });
    host.setState('ready');
    host.setLastErrorKind(null);
    activeController.clearUnexpectedExitError();
    return {
      controller: activeController,
      rawOutput: bootReady.rawOutput,
    };
  } catch (err: any) {
    host.setState('degraded');
    host.setLastErrorKind('boot_timeout');
    return host.buildErrorResult(phase, 'degraded', 'boot_timeout', true, '', {
      summary: `SuperCollider server did not become ready in time: ${err.message}`,
    });
  }
}

export async function stopAndClearController(
  host: SessionLifecycleHost,
  ignoreErrors: boolean,
): Promise<void> {
  const controller = host.getController();
  if (!controller) {
    host.setState('stopped');
    host.setSessionId(null);
    return;
  }

  host.setController(null);
  host.setSessionId(null);

  try {
    await controller.stop();
    host.setState('stopped');
    host.setLastErrorKind(null);
  } catch {
    host.setState('degraded');
    host.setLastErrorKind('cleanup_failed');
    if (!ignoreErrors) {
      throw new Error('Failed to stop the active SuperCollider session.');
    }
  }
}

export function buildEvalLikeResult(
  host: SessionLifecycleHost,
  phase: string,
  bootOutput: string,
  commandOutput: string,
): DriverResult {
  const rawOutput = host.mergeOutput(bootOutput, commandOutput);

  if (containsScRuntimeError(rawOutput)) {
    host.setState('ready');
    host.setLastErrorKind('sc_runtime_error');
    return host.buildErrorResult(phase, 'ready', 'sc_runtime_error', true, rawOutput, {
      summary: 'SuperCollider reported a runtime error while executing the command.',
    });
  }

  host.setState('ready');
  host.setLastErrorKind(null);
  return host.buildSuccessResult(phase, 'ready', rawOutput, {
    summary: 'SuperCollider executed the command successfully.',
  });
}
