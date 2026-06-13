export type ArchiveRecordKind =
  | 'probe_run'
  | 'candidate_lifecycle'
  | 'review_note'
  | 'session_summary'
  | 'session_audit';

export interface SessionAuditArchivePayload {
  records_considered: number;
  session_audit: unknown;
  task_tag: string | null;
}

export interface ArchiveRecord<TPayload = unknown> {
  id: string;
  kind: ArchiveRecordKind;
  session_id: string;
  created_at: string;
  payload: TPayload;
}

export interface ArchiveAppendInput<TPayload = unknown> {
  kind: ArchiveRecordKind;
  session_id: string;
  payload: TPayload;
  created_at?: string;
  id?: string;
}

export interface ArchiveMemorySummaryOptions {
  session_id?: string;
  candidate_id?: string;
  limit?: number;
}

export interface ArchiveRecentSessionSummary {
  session_id: string;
  last_recorded_at: string;
  record_count: number;
  kinds: ArchiveRecordKind[];
  audit_count: number;
  candidate_ids: string[];
  probe_ids: string[];
  outcomes: string[];
}

export interface ArchiveRepeatedFailureSummary {
  failure: string;
  count: number;
  session_ids: string[];
  candidate_ids: string[];
}

export interface ArchivePreservedItemPatternSummary {
  pattern: string;
  count: number;
  examples: string[];
}

export interface ArchiveProbeRunStats {
  total: number;
  success: number;
  failure: number;
}

export interface ArchiveRenderModeStats extends ArchiveProbeRunStats {}

export interface ArchiveMemorySummary {
  records_considered: number;
  recent_sessions: ArchiveRecentSessionSummary[];
  candidate_counts_by_status: Record<string, number>;
  review_rejection_reason_distribution: Record<string, number>;
  repeated_failures: ArchiveRepeatedFailureSummary[];
  preserved_item_patterns: ArchivePreservedItemPatternSummary[];
  probe_run_outcomes: ArchiveProbeRunStats;
  probe_run_modes: Record<string, number>;
  render_mode_outcomes: Record<string, ArchiveRenderModeStats>;
  nrt_failure_distribution: Record<string, number>;
  final_artifact_completion_ratio: number;
  session_outcomes: Record<string, number>;
}
