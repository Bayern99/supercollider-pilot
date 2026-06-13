import type {
  EngineKind,
  EnginePreference,
  RenderMode,
  RequestedSampleFormat,
  RenderSampleFormat,
} from '../runtime/driver-types.js';

export type ProbeExecutionMode = 'eval' | 'run_file' | 'render' | 'render_nrt';

export interface ProbeRenderOptions {
  duration_sec?: number;
  engine_preference?: EnginePreference;
  out_path: string;
  sample_format?: RequestedSampleFormat;
}

export interface ProbeSpec {
  id: string;
  title: string;
  question: string;
  mode: ProbeExecutionMode;
  code?: string;
  file_path?: string;
  render?: ProbeRenderOptions;
  tags: string[];
  notes?: string;
  metadata?: Record<string, string>;
}

export interface ProbeArtifactRef {
  kind: 'render' | 'log' | 'file';
  path?: string;
  bytes?: number;
  duration_sec?: number;
  label?: string;
  render_mode?: RenderMode;
  engine_used?: EngineKind;
  sample_rate?: number;
  sample_format?: RenderSampleFormat;
  channel_count?: number;
  frame_count?: number;
}

export interface ProbeDriverArtifact {
  path: string;
  bytes: number;
  duration_sec?: number;
  render_mode?: RenderMode;
  engine_used?: EngineKind;
  sample_rate?: number;
  sample_format?: RenderSampleFormat;
  channel_count?: number;
  frame_count?: number;
}

export interface ProbeDriverResult {
  success: boolean;
  summary: string;
  raw_output: string;
  artifact?: ProbeDriverArtifact;
}

export interface ProbeDriver {
  eval(code: string): Promise<ProbeDriverResult>;
  runFile(filePath: string): Promise<ProbeDriverResult>;
  render(options: {
    durationSec?: number;
    filePath?: string;
    outPath: string;
    userCode?: string;
  }): Promise<ProbeDriverResult>;
  renderNrt(options: {
    durationSec?: number;
    enginePreference?: EnginePreference;
    outPath: string;
    sampleFormat?: RequestedSampleFormat;
    sourcePath: string;
  }): Promise<ProbeDriverResult>;
}

export interface ProbeRunResult {
  probe_id: string;
  session_id: string;
  success: boolean;
  summary: string;
  raw_output: string;
  artifacts: ProbeArtifactRef[];
  started_at: string;
  finished_at: string;
}

export type CandidateStatus = 'draft' | 'candidate' | 'accepted' | 'rejected' | 'revisit';

export type CandidateLifecycleAction =
  | 'create'
  | 'promote'
  | 'accept'
  | 'reject'
  | 'revisit'
  | 'rename'
  | 'split'
  | 'merge'
  | 'deprecate';

export interface CandidateReviewNote {
  reviewer: string;
  verdict: 'keep' | 'reject' | 'revisit';
  summary: string;
  details?: string;
  created_at?: string;
}

export interface CandidateLifecycleEvent {
  candidate_id: string;
  action: CandidateLifecycleAction;
  from_status: CandidateStatus | null;
  to_status: CandidateStatus;
  summary: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface PrimitiveCandidate {
  id: string;
  name: string;
  status: CandidateStatus;
  source_probe_id: string;
  created_at: string;
  updated_at: string;
  deprecated_at?: string;
  superseded_by?: string[];
  split_into?: string[];
  merged_from?: string[];
  artifacts: ProbeArtifactRef[];
  reviews: CandidateReviewNote[];
  history: CandidateLifecycleEvent[];
  metadata: Record<string, unknown>;
}
