const STUB_SOURCE = `
export async function buildMemorySummary(_archive, input = {}) {
  return {
    records_considered: input.limit ?? 0,
    recent_sessions: [],
    candidate_counts_by_status: {},
    review_rejection_reason_distribution: {},
    repeated_failures: [],
    preserved_item_patterns: [],
    probe_run_outcomes: { total: 0, success: 0, failure: 0 },
    probe_run_modes: {},
    render_mode_outcomes: {},
    nrt_failure_distribution: {},
    final_artifact_completion_ratio: 0,
    session_outcomes: {},
  };
}

export function buildArchiveMemorySummary(_records, options = {}) {
  return {
    records_considered: options.limit ?? 0,
    recent_sessions: [],
    candidate_counts_by_status: {},
    review_rejection_reason_distribution: {},
    repeated_failures: [],
    preserved_item_patterns: [],
    probe_run_outcomes: { total: 0, success: 0, failure: 0 },
    probe_run_modes: {},
    render_mode_outcomes: {},
    nrt_failure_distribution: {},
    final_artifact_completion_ratio: 0,
    session_outcomes: {},
  };
}
`;

const STUB_URL = `data:text/javascript,${encodeURIComponent(STUB_SOURCE)}`;

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === './memory-summary.js' || specifier === '../archive/memory-summary.js') {
    return {
      url: STUB_URL,
      shortCircuit: true,
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}
