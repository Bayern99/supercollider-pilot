import { ProbeRunResult } from '../lab/lab-types.js';

export interface SessionSummaryInput {
  session_id: string;
  task: string;
  probe?: ProbeRunResult;
  outcome: 'success' | 'failure' | 'mixed';
  preserved_items: string[];
  failures: string[];
  notes?: string[];
}

export interface SessionSummary {
  session_id: string;
  task: string;
  outcome: 'success' | 'failure' | 'mixed';
  summary: string;
  probe_id?: string;
  preserved_items: string[];
  failures: string[];
  notes: string[];
  created_at: string;
}

export function buildSessionSummary(input: SessionSummaryInput): SessionSummary {
  const notes = [...(input.notes ?? [])];
  const createdAt = new Date().toISOString();
  const probeClause = input.probe ? ` Probe ${input.probe.probe_id} ${input.probe.success ? 'succeeded' : 'failed'}.` : '';
  const preservedClause =
    input.preserved_items.length > 0
      ? ` Preserved: ${input.preserved_items.join(', ')}.`
      : ' Preserved: none.';
  const failureClause =
    input.failures.length > 0 ? ` Failures: ${input.failures.join('; ')}.` : ' Failures: none.';

  return {
    session_id: input.session_id,
    task: input.task,
    outcome: input.outcome,
    summary: `${input.task} ended ${input.outcome}.${probeClause}${preservedClause}${failureClause}`,
    probe_id: input.probe?.probe_id,
    preserved_items: input.preserved_items,
    failures: input.failures,
    notes,
    created_at: createdAt,
  };
}
