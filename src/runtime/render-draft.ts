import { DriverResult, RenderArtifact } from './driver-types.js';
import { buildRenderArtifact, isRenderArtifactValid } from './render-artifact.js';
import {
  buildRenderStartScript,
  buildRenderStopScript,
  containsScRuntimeError,
  makeMarker,
} from './protocol.js';
import {
  ensureReadyController,
  SessionLifecycleHost,
  stopAndClearController,
} from './session-lifecycle.js';

export async function runDraftRender(
  host: SessionLifecycleHost,
  options: {
    durationSec?: number;
    outPath: string;
    userCode: string;
  },
): Promise<DriverResult<RenderArtifact>> {
  const durationSec = options.durationSec ?? 5;
  if (!options.outPath.trim()) {
    return host.buildErrorResult('render', host.getState(), 'invalid_argument', false, '', {
      summary: 'A writable output WAV path is required.',
    });
  }
  if (!options.userCode.trim()) {
    return host.buildErrorResult('render', host.getState(), 'invalid_argument', false, '', {
      summary: 'Render code must not be empty.',
    });
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return host.buildErrorResult('render', host.getState(), 'invalid_argument', false, '', {
      summary: 'Render duration must be a positive number.',
    });
  }

  const ready = await ensureReadyController(host, 'render');
  if ('success' in ready) {
    return ready;
  }

  host.setState('busy');
  host.setPhase('render');

  const startMarker = makeMarker('render_start');
  const stopMarker = makeMarker('render_stop');
  let output = ready.rawOutput;
  let stopCompleted = false;

  try {
    const start = await ready.controller.runScript(
      buildRenderStartScript(
        {
          durationSec,
          outPath: options.outPath,
          userCode: options.userCode,
        },
        startMarker,
      ),
      {
        completionMarkers: [startMarker],
        timeoutMs: host.executeTimeoutMs,
      },
    );

    output = host.mergeOutput(output, start.rawOutput);
    if (containsScRuntimeError(output)) {
      const artifact = buildRenderArtifact(
        options.outPath,
        durationSec,
        output,
        false,
        'draft',
        'scsynth',
      );
      await stopAndClearController(host, true);
      return host.buildErrorResult('render', 'stopped', 'sc_runtime_error', true, output, {
        summary: 'Render setup failed because SuperCollider reported an error.',
        artifact,
      });
    }

    await host.sleepMs(durationSec * 1_000);

    const stop = await ready.controller.runScript(buildRenderStopScript(stopMarker), {
      completionMarkers: [stopMarker],
      timeoutMs: host.executeTimeoutMs,
    });
    stopCompleted = true;
    output = host.mergeOutput(output, stop.rawOutput);
    const artifact = buildRenderArtifact(
      options.outPath,
      durationSec,
      output,
      true,
      'draft',
      'scsynth',
    );

    await stopAndClearController(host, true);

    if (!isRenderArtifactValid(artifact)) {
      return host.buildErrorResult('render', 'stopped', 'render_failed', true, output, {
        summary: 'Render finished without producing a valid non-empty WAV artifact.',
        artifact,
      });
    }

    return host.buildSuccessResult('render', 'stopped', output, {
      summary: 'Render completed and produced a draft WAV artifact.',
      artifact,
    });
  } catch (err: any) {
    const artifact = buildRenderArtifact(
      options.outPath,
      durationSec,
      output,
      stopCompleted,
      'draft',
      'scsynth',
    );
    await stopAndClearController(host, true);
    return host.buildErrorResult('render', 'stopped', 'render_failed', true, output, {
      summary: `Render flow failed: ${err.message}`,
      artifact,
    });
  }
}
