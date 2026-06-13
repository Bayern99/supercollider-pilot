import fs from 'fs';
import path from 'path';
import {
  EngineKind,
  EnginePreference,
  DriverResult,
  DriverState,
  RenderArtifact,
  RequestedSampleFormat,
  RuntimeCapabilities,
} from './driver-types.js';
import { containsScRuntimeError } from './protocol.js';
import { runNrtRender } from './render-nrt.js';
import { buildRenderArtifact, isRenderArtifactValid } from './render-artifact.js';

export interface RenderNrtHost {
  discoverPath(): string | null;
  getCapabilities(sclangPath: string | null): RuntimeCapabilities;
  getState(): DriverState;
  setState(state: DriverState): void;
  executeTimeoutMs: number;
  runNrt: typeof runNrtRender;
  resolveNrtEngine(
    preference: EnginePreference,
    capabilities: RuntimeCapabilities,
  ): { kind: EngineKind; path: string } | null;
  buildErrorResult<TArtifact>(
    phase: string,
    state: DriverState,
    errorKind: import('./driver-types.js').DriverErrorKind,
    recoverable: boolean,
    rawOutput: string,
    extras: {
      artifact?: TArtifact;
      capabilities?: RuntimeCapabilities;
      summary: string;
    },
  ): DriverResult<TArtifact>;
  buildSuccessResult<TArtifact>(
    phase: string,
    state: DriverState,
    rawOutput: string,
    extras: {
      artifact?: TArtifact;
      capabilities?: RuntimeCapabilities;
      summary: string;
    },
  ): DriverResult<TArtifact>;
}

export async function runNrtRenderCommand(
  host: RenderNrtHost,
  options: {
    durationSec?: number;
    enginePreference?: EnginePreference;
    outPath: string;
    sampleFormat?: RequestedSampleFormat;
    sourcePath: string;
  },
): Promise<DriverResult<RenderArtifact>> {
  const sourcePath = options.sourcePath.trim();
  const outPath = options.outPath.trim();
  const enginePreference = options.enginePreference ?? 'auto';
  const sampleFormat = options.sampleFormat ?? 'float';

  if (!sourcePath) {
    return host.buildErrorResult('render_nrt', host.getState(), 'invalid_argument', false, '', {
      summary: 'An absolute .scd source path is required for NRT rendering.',
    });
  }
  if (!path.isAbsolute(sourcePath)) {
    return host.buildErrorResult('render_nrt', host.getState(), 'invalid_argument', false, '', {
      summary: 'NRT rendering requires an absolute .scd source path.',
    });
  }
  if (!sourcePath.toLowerCase().endsWith('.scd')) {
    return host.buildErrorResult('render_nrt', host.getState(), 'invalid_argument', false, '', {
      summary: 'NRT rendering only accepts .scd source files.',
    });
  }
  if (!outPath) {
    return host.buildErrorResult('render_nrt', host.getState(), 'invalid_argument', false, '', {
      summary: 'An absolute output WAV path is required for NRT rendering.',
    });
  }
  if (!path.isAbsolute(outPath)) {
    return host.buildErrorResult('render_nrt', host.getState(), 'invalid_argument', false, '', {
      summary: 'NRT rendering requires an absolute output WAV path.',
    });
  }
  try {
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile()) {
      return host.buildErrorResult('render_nrt', host.getState(), 'invalid_argument', false, '', {
        summary: `Path is not a regular file: ${sourcePath}`,
      });
    }
  } catch {
    return host.buildErrorResult('render_nrt', host.getState(), 'invalid_argument', false, '', {
      summary: `File not found: ${sourcePath}`,
    });
  }
  if (!['float', 'double'].includes(sampleFormat)) {
    return host.buildErrorResult('render_nrt', host.getState(), 'invalid_argument', false, '', {
      summary: 'NRT sample_format must be float or double.',
    });
  }

  const sclangPath = host.discoverPath();
  const capabilities = host.getCapabilities(sclangPath);

  if (!sclangPath) {
    host.setState('engine_missing');
    return host.buildErrorResult('render_nrt', 'engine_missing', 'engine_missing', false, '', {
      capabilities,
      summary: 'SuperCollider engine is not installed or not discoverable.',
    });
  }

  const engine = host.resolveNrtEngine(enginePreference, capabilities);
  if (!engine) {
    return host.buildErrorResult(
      'render_nrt',
      host.getState(),
      'capability_unavailable',
      false,
      '',
      {
        capabilities,
        summary:
          enginePreference === 'supernova'
            ? 'supernova was explicitly requested but is not available on this machine.'
            : 'NRT rendering is unavailable because the required SuperCollider engine binaries were not found.',
      },
    );
  }

  const result = await host.runNrt({
    durationSec: options.durationSec,
    enginePath: engine.path,
    engineUsed: engine.kind,
    executeTimeoutMs: host.executeTimeoutMs,
    outPath,
    sampleFormat,
    sclangPath,
    sourcePath,
  });

  const artifact = buildRenderArtifact(
    outPath,
    options.durationSec ?? 0,
    result.raw_output,
    result.success,
    'nrt',
    engine.kind,
  );

  if (!result.success) {
    const errorKind = containsScRuntimeError(result.raw_output)
      ? 'sc_runtime_error'
      : 'render_failed';
    return host.buildErrorResult('render_nrt', host.getState(), errorKind, true, result.raw_output, {
      artifact,
      capabilities,
      summary:
        errorKind === 'sc_runtime_error'
          ? 'NRT rendering failed because SuperCollider reported a runtime error.'
          : 'NRT rendering did not complete successfully.',
    });
  }

  if (!isRenderArtifactValid(artifact)) {
    return host.buildErrorResult('render_nrt', host.getState(), 'render_failed', true, result.raw_output, {
      artifact,
      capabilities,
      summary: 'NRT rendering finished without producing a valid WAV artifact.',
    });
  }

  return host.buildSuccessResult('render_nrt', host.getState(), result.raw_output, {
    artifact,
    capabilities,
    summary: 'NRT render completed and produced a final-quality WAV artifact.',
  });
}
