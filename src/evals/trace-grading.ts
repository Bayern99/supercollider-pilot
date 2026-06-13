import { buildSummary, type EvalMetric } from './eval-types.js';

export interface TraceStep {
  name: string;
  category: 'plan' | 'execute' | 'review' | 'recovery';
  success: boolean;
  rejection_reason?: string;
}

export interface TraceGradingInput {
  steps: readonly TraceStep[];
  candidate_promoted?: boolean;
}

export interface TraceGradingResult {
  completion_rate: number;
  recovery_invocation_rate: number;
  review_rejection_reason_distribution: Record<string, number>;
  summary: ReturnType<typeof buildSummary>;
}

export function gradeTrace(input: TraceGradingInput): TraceGradingResult {
  const steps = [...input.steps];
  const successfulSteps = steps.filter((step) => step.success).length;
  const recoverySteps = steps.filter((step) => step.category === 'recovery');
  const reviewRejections = steps.filter(
    (step) => step.category === 'review' && !step.success,
  );

  const rejectionDistribution: Record<string, number> = {};
  for (const step of reviewRejections) {
    const key = step.rejection_reason ?? 'unknown';
    rejectionDistribution[key] = (rejectionDistribution[key] ?? 0) + 1;
  }

  const completionRate = steps.length === 0 ? 0 : successfulSteps / steps.length;
  const recoveryInvocationRate =
    steps.length === 0 ? 0 : recoverySteps.length / steps.length;

  const metrics: EvalMetric[] = [
    {
      name: 'trace_completion_rate',
      value: completionRate,
      weight: 3,
    },
    {
      name: 'recovery_invocation_rate',
      value: 1 - recoveryInvocationRate,
      weight: 1,
      details: `${recoverySteps.length} recovery steps across ${steps.length} total steps.`,
    },
    {
      name: 'candidate_acceptance_ratio',
      value: input.candidate_promoted ? 1 : 0,
      weight: 2,
    },
  ];

  const issues =
    reviewRejections.length === 0
      ? []
      : [
          {
            code: 'review_rejection',
            message: `Trace contains ${reviewRejections.length} rejected review steps.`,
            severity: 'warn' as const,
          },
        ];

  return {
    completion_rate: completionRate,
    recovery_invocation_rate: recoveryInvocationRate,
    review_rejection_reason_distribution: rejectionDistribution,
    summary: buildSummary({
      evaluator: 'trace_grading',
      metrics,
      issues,
      signals: Object.entries(rejectionDistribution).map(([reason, count]) => ({
        name: 'review_rejection_reason_distribution',
        status: 'negative' as const,
        details: `${reason}:${count}`,
      })),
      notes: ['Aggregates planner, execution, review, and recovery steps.'],
    }),
  };
}
