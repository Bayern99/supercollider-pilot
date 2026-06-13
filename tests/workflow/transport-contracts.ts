export const WORKFLOW_TRANSPORTS = [
  {
    cli: 'plan-workflow',
    mcp: 'sc_plan_workflow',
    resultKeys: [
      'workflow',
      'confidence',
      'reasons',
      'recommended_execution_mode',
      'recommended_tools',
      'primary_role',
    ],
  },
  {
    cli: 'run-probe',
    mcp: 'sc_run_probe',
    resultKeys: [
      'probe_id',
      'session_id',
      'success',
      'summary',
      'raw_output',
      'artifacts',
      'started_at',
      'finished_at',
    ],
  },
  {
    cli: 'summarize-session',
    mcp: 'sc_summarize_session',
    resultKeys: [
      'session_id',
      'task',
      'outcome',
      'summary',
      'probe_id',
      'preserved_items',
      'failures',
      'notes',
      'created_at',
    ],
  },
  {
    cli: 'candidate-action',
    mcp: 'sc_candidate_action',
    resultKeys: [
      'id',
      'name',
      'status',
      'source_probe_id',
      'created_at',
      'updated_at',
      'artifacts',
      'reviews',
      'history',
      'metadata',
    ],
  },
  {
    cli: 'memory-summary',
    mcp: 'sc_memory_summary',
    resultKeys: [
      'records_considered',
      'recent_sessions',
      'candidate_counts_by_status',
      'review_rejection_reason_distribution',
      'repeated_failures',
      'preserved_item_patterns',
      'probe_run_outcomes',
      'probe_run_modes',
      'render_mode_outcomes',
      'nrt_failure_distribution',
      'final_artifact_completion_ratio',
      'session_outcomes',
    ],
  },
  {
    cli: 'prepare-handoff',
    mcp: 'sc_prepare_handoff',
    resultKeys: [
      'task',
      'workflow_plan',
      'kb_snapshot',
      'role_packets',
      'recommended_loop',
    ],
  },
  {
    cli: 'audit-session',
    mcp: 'sc_audit_session',
    resultKeys: [
      'session_id',
      'task_tag',
      'path_compliance',
      'artifact_completion',
      'summary_present',
      'review_gate',
      'candidate_state',
      'recommended_next_step',
      'issues',
    ],
  },
] as const;

export const BASE_TRANSPORTS = {
  cli: ['check', 'status', 'health', 'eval', 'run', 'logs', 'render', 'render-nrt', 'stop', 'reset', 'reboot', 'reclaim'],
  mcp: [
    'sc_check',
    'sc_status',
    'sc_health',
    'sc_eval',
    'sc_run_file',
    'sc_logs',
    'sc_render',
    'sc_render_nrt',
    'sc_stop',
    'sc_reset',
    'sc_reboot',
    'sc_reclaim',
  ],
} as const;

export function findWorkflowTransportByMcpName(name: string) {
  return WORKFLOW_TRANSPORTS.find((entry) => entry.mcp === name);
}

export function findWorkflowTransportByCliName(name: string) {
  return WORKFLOW_TRANSPORTS.find((entry) => entry.cli === name);
}
