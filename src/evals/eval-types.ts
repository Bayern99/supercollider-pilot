export type EvalGrade = 'pass' | 'warn' | 'fail';

export type EvalSeverity = 'info' | 'warn' | 'error';

export type EvalSignalStatus = 'positive' | 'neutral' | 'negative';

export interface EvalIssue {
  code: string;
  message: string;
  severity: EvalSeverity;
  path?: string;
}

export interface EvalMetric {
  name: string;
  value: number;
  weight?: number;
  details?: string;
}

export interface EvalSignal {
  name: string;
  status: EvalSignalStatus;
  details?: string;
}

export interface EvalSummary {
  evaluator: string;
  grade: EvalGrade;
  score: number;
  metrics: EvalMetric[];
  issues: EvalIssue[];
  signals: EvalSignal[];
  notes: string[];
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function weightedScore(metrics: readonly EvalMetric[]): number {
  if (metrics.length === 0) {
    return 0;
  }

  let totalWeight = 0;
  let totalValue = 0;

  for (const metric of metrics) {
    const weight = metric.weight ?? 1;
    totalWeight += weight;
    totalValue += clampScore(metric.value) * weight;
  }

  return totalWeight === 0 ? 0 : totalValue / totalWeight;
}

export function hasSeverity(
  issues: readonly EvalIssue[],
  severity: EvalSeverity,
): boolean {
  return issues.some((issue) => issue.severity === severity);
}

export function deriveGrade(
  score: number,
  issues: readonly EvalIssue[],
): EvalGrade {
  const clamped = clampScore(score);

  if (hasSeverity(issues, 'error') || clamped < 0.5) {
    return 'fail';
  }

  if (hasSeverity(issues, 'warn') || clamped < 0.8) {
    return 'warn';
  }

  return 'pass';
}

export function buildSummary(input: {
  evaluator: string;
  metrics?: readonly EvalMetric[];
  issues?: readonly EvalIssue[];
  signals?: readonly EvalSignal[];
  notes?: readonly string[];
  score?: number;
}): EvalSummary {
  const metrics = [...(input.metrics ?? [])];
  const issues = [...(input.issues ?? [])];
  const signals = [...(input.signals ?? [])];
  const notes = [...(input.notes ?? [])];
  const score =
    typeof input.score === 'number' ? clampScore(input.score) : weightedScore(metrics);

  return {
    evaluator: input.evaluator,
    grade: deriveGrade(score, issues),
    score,
    metrics,
    issues,
    signals,
    notes,
  };
}
