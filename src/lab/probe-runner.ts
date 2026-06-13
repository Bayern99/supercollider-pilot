import { ArchiveStore } from '../archive/archive-store.js';
import { ProbeRunResult, ProbeSpec, ProbeDriver, ProbeArtifactRef } from './lab-types.js';
import { assertValidProbeSpec } from './probe-spec.js';

export interface ProbeRunContext {
  session_id?: string;
  archive?: ArchiveStore;
  started_at?: string;
}

function makeSessionId(): string {
  return `lab-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function collectArtifacts(
  rawOutput: string,
  artifact?: {
    path: string;
    bytes: number;
    duration_sec?: number;
    render_mode?: ProbeArtifactRef['render_mode'];
    engine_used?: ProbeArtifactRef['engine_used'];
    sample_rate?: number;
    sample_format?: ProbeArtifactRef['sample_format'];
    channel_count?: number;
    frame_count?: number;
  },
): ProbeArtifactRef[] {
  const artifacts: ProbeArtifactRef[] = [];

  if (artifact) {
    const labelParts = [];
    if (typeof artifact.duration_sec === 'number') {
      labelParts.push(`${artifact.duration_sec}s`);
    }
    if (artifact.render_mode === 'draft' || artifact.render_mode === 'nrt') {
      labelParts.push(artifact.render_mode);
    }
    labelParts.push('render');

    const renderArtifact: ProbeArtifactRef = {
      kind: 'render',
      path: artifact.path,
      bytes: artifact.bytes,
      label: labelParts.join(' '),
    };
    if (typeof artifact.duration_sec === 'number') {
      renderArtifact.duration_sec = artifact.duration_sec;
    }
    if (artifact.render_mode) {
      renderArtifact.render_mode = artifact.render_mode;
    }
    if (artifact.engine_used) {
      renderArtifact.engine_used = artifact.engine_used;
    }
    if (typeof artifact.sample_rate === 'number') {
      renderArtifact.sample_rate = artifact.sample_rate;
    }
    if (artifact.sample_format) {
      renderArtifact.sample_format = artifact.sample_format;
    }
    if (typeof artifact.channel_count === 'number') {
      renderArtifact.channel_count = artifact.channel_count;
    }
    if (typeof artifact.frame_count === 'number') {
      renderArtifact.frame_count = artifact.frame_count;
    }

    artifacts.push(renderArtifact);
  }

  if (rawOutput.trim()) {
    artifacts.push({
      kind: 'log',
      label: 'probe output',
    });
  }

  return artifacts;
}

export async function runProbe(
  driver: ProbeDriver,
  spec: ProbeSpec,
  context: ProbeRunContext = {},
): Promise<ProbeRunResult> {
  assertValidProbeSpec(spec);

  const sessionId = context.session_id ?? makeSessionId();
  const startedAt = context.started_at ?? new Date().toISOString();

  let result;
  if (spec.mode === 'eval') {
    result = await driver.eval(spec.code!);
  } else if (spec.mode === 'run_file') {
    result = await driver.runFile(spec.file_path!);
  } else if (spec.mode === 'render_nrt') {
    result = await driver.renderNrt({
      durationSec: spec.render?.duration_sec,
      enginePreference: spec.render?.engine_preference,
      outPath: spec.render!.out_path,
      sampleFormat: spec.render?.sample_format,
      sourcePath: spec.file_path!,
    });
  } else {
    result = await driver.render({
      durationSec: spec.render?.duration_sec,
      filePath: spec.file_path,
      outPath: spec.render!.out_path,
      userCode: spec.code,
    });
  }

  const probeRun: ProbeRunResult = {
    probe_id: spec.id,
    session_id: sessionId,
    success: result.success,
    summary: result.summary,
    raw_output: result.raw_output,
    artifacts: collectArtifacts(result.raw_output, result.artifact),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  };

  if (context.archive) {
    await context.archive.append({
      kind: 'probe_run',
      session_id: sessionId,
      payload: {
        spec,
        result: probeRun,
      },
      created_at: probeRun.finished_at,
    });
  }

  return probeRun;
}
