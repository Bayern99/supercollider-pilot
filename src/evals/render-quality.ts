import { analyzeWavFile } from '../runtime/wav.js';
import { buildSummary, type EvalIssue, type EvalMetric } from './eval-types.js';

export interface RenderArtifactLike {
  path?: string;
  bytes?: number;
  duration_sec?: number;
  render_mode?: 'draft' | 'nrt';
  sample_rate?: number;
  sample_format?: string;
  channel_count?: number;
  frame_count?: number;
}

export interface RenderQualityInput {
  success: boolean;
  artifact?: RenderArtifactLike;
  expected_duration_sec?: number;
  max_duration_drift_sec?: number;
  silence_ratio?: number;
  clipping_detected?: boolean;
}

export interface RenderQualityWaveformAnalysis {
  channel_count: number;
  clipping_detected: boolean;
  frame_count: number;
  peak: number;
  sample_format: string;
  sample_rate: number;
  silence_ratio: number;
}

export interface RenderQualityResult {
  usable: boolean;
  duration_delta_sec: number | null;
  summary: ReturnType<typeof buildSummary>;
  waveform_analysis: RenderQualityWaveformAnalysis | null;
}

export function evaluateRenderQuality(
  input: RenderQualityInput,
): RenderQualityResult {
  const artifact = input.artifact;
  const maxDrift = input.max_duration_drift_sec ?? 0.25;
  let waveform:
    | (RenderQualityWaveformAnalysis & {
        duration_sec: number;
      })
    | null = null;
  let parseError: string | null = null;

  if (artifact?.path) {
    try {
      const analysis = analyzeWavFile(artifact.path);
      waveform = {
        channel_count: analysis.channel_count,
        clipping_detected: analysis.clipping_detected,
        duration_sec: analysis.duration_sec,
        frame_count: analysis.frame_count,
        peak: analysis.peak,
        sample_format: analysis.sample_format,
        sample_rate: analysis.sample_rate,
        silence_ratio: analysis.silence_ratio,
      };
    } catch (err: any) {
      parseError = err.message;
    }
  }

  const duration = waveform?.duration_sec ?? artifact?.duration_sec;
  const expectedDuration = input.expected_duration_sec;
  const durationDelta =
    typeof duration === 'number' && typeof expectedDuration === 'number'
      ? Math.abs(duration - expectedDuration)
      : null;
  const silenceRatio = waveform?.silence_ratio ?? input.silence_ratio;
  const clippingDetected = waveform?.clipping_detected ?? input.clipping_detected;

  const issues: EvalIssue[] = [];
  if (!input.success) {
    issues.push({
      code: 'render_failed',
      message: 'Render did not report success.',
      severity: 'error',
    });
  }
  if (!artifact || (artifact.bytes ?? 0) <= 0) {
    issues.push({
      code: 'empty_artifact',
      message: 'Render did not produce a non-empty artifact.',
      severity: 'error',
    });
  }
  if (typeof duration === 'number' && duration <= 0) {
    issues.push({
      code: 'invalid_duration',
      message: 'Render artifact has a non-positive duration.',
      severity: 'error',
    });
  }
  if (parseError) {
    issues.push({
      code: 'wav_parse_failed',
      message: `Render artifact could not be parsed as WAV: ${parseError}`,
      severity: 'error',
    });
  }
  if (waveform && waveform.frame_count <= 0) {
    issues.push({
      code: 'empty_frames',
      message: 'Render WAV contains zero audio frames.',
      severity: 'error',
    });
  }
  if (durationDelta !== null && durationDelta > maxDrift) {
    issues.push({
      code: 'duration_drift',
      message: `Render duration drifted by ${durationDelta.toFixed(3)}s.`,
      severity: 'warn',
    });
  }
  if (typeof silenceRatio === 'number' && silenceRatio >= 0.98) {
    issues.push({
      code: 'mostly_silence',
      message: 'Render appears to be almost entirely silent.',
      severity: 'warn',
    });
  }
  if (clippingDetected) {
    issues.push({
      code: 'clipping_detected',
      message: 'Render reported clipping.',
      severity: 'warn',
    });
  }

  const metrics: EvalMetric[] = [
    {
      name: 'render_success_rate',
      value: input.success ? 1 : 0,
      weight: 3,
    },
    {
      name: 'artifact_completion_rate',
      value: artifact && (artifact.bytes ?? 0) > 0 ? 1 : 0,
      weight: 3,
    },
    {
      name: 'duration_match_rate',
      value:
        durationDelta === null ? 1 : Math.max(0, 1 - durationDelta / Math.max(maxDrift, 0.001)),
      weight: 2,
      details:
        durationDelta === null
          ? 'No expected duration was supplied.'
          : `Delta ${durationDelta.toFixed(3)}s against max drift ${maxDrift.toFixed(3)}s.`,
    },
    {
      name: 'silence_health',
      value: typeof silenceRatio === 'number' ? Math.max(0, 1 - silenceRatio) : 1,
      weight: 1,
    },
    {
      name: 'frame_presence',
      value: waveform ? (waveform.frame_count > 0 ? 1 : 0) : 1,
      weight: 2,
    },
  ];

  const summary = buildSummary({
    evaluator: 'render_quality',
    metrics,
    issues,
    signals: [
      {
        name: 'artifact_path',
        status: artifact?.path ? 'positive' : 'neutral',
        details: artifact?.path,
      },
      {
        name: 'sample_rate',
        status: waveform?.sample_rate ? 'positive' : 'neutral',
        details: waveform?.sample_rate ? String(waveform.sample_rate) : undefined,
      },
      {
        name: 'render_mode',
        status: artifact?.render_mode ? 'positive' : 'neutral',
        details: artifact?.render_mode,
      },
    ],
    notes: ['Uses internal WAV parsing for silence, clipping, duration, and frame checks.'],
  });

  return {
    usable: summary.grade !== 'fail',
    duration_delta_sec: durationDelta,
    summary,
    waveform_analysis: waveform
      ? {
          channel_count: waveform.channel_count,
          clipping_detected: waveform.clipping_detected,
          frame_count: waveform.frame_count,
          peak: waveform.peak,
          sample_format: waveform.sample_format,
          sample_rate: waveform.sample_rate,
          silence_ratio: waveform.silence_ratio,
        }
      : null,
  };
}
