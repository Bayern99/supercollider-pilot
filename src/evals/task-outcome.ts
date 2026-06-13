import { buildSummary, type EvalIssue, type EvalMetric } from './eval-types.js';
import type { WorkflowKind } from '../planner/sc-spec-schema.js';

export type ScTaskLabel =
  | 'sc-audio-generation'
  | 'sc-probe'
  | 'sc-render-review';

export interface TaskOutcomeInput {
  task_label: ScTaskLabel;
  workflow?: WorkflowKind;
  execution_success: boolean;
  artifact_present?: boolean;
  review_passed?: boolean | null;
  recovery_invoked?: boolean;
  error_kind?: string | null;
}

export interface TaskOutcomeResult {
  completed: boolean;
  summary: ReturnType<typeof buildSummary>;
}

function taskNeedsArtifact(input: TaskOutcomeInput): boolean {
  return (
    input.task_label === 'sc-audio-generation' ||
    input.task_label === 'sc-render-review' ||
    input.workflow === 'render_qa'
  );
}

export function evaluateTaskOutcome(
  input: TaskOutcomeInput,
): TaskOutcomeResult {
  const artifactRequired = taskNeedsArtifact(input);
  const artifactPresent = input.artifact_present ?? false;
  const reviewGateSatisfied =
    input.review_passed === null ||
    typeof input.review_passed === 'undefined' ||
    input.review_passed;

  const completed =
    input.execution_success && (!artifactRequired || artifactPresent) && reviewGateSatisfied;

  const issues: EvalIssue[] = [];
  if (!input.execution_success) {
    issues.push({
      code: 'execution_failed',
      message: 'Task execution did not finish successfully.',
      severity: 'error',
    });
  }
  if (artifactRequired && !artifactPresent) {
    issues.push({
      code: 'artifact_missing',
      message: 'Task required an artifact but none was present.',
      severity: 'error',
    });
  }
  if (input.review_passed === false) {
    issues.push({
      code: 'review_rejected',
      message: 'Review gate rejected the task output.',
      severity: 'warn',
    });
  }
  if (input.error_kind) {
    issues.push({
      code: 'driver_error_kind',
      message: `Driver reported error kind: ${input.error_kind}`,
      severity: input.execution_success ? 'warn' : 'error',
    });
  }

  const metrics: EvalMetric[] = [
    {
      name: 'artifact_completion_rate',
      value: artifactRequired ? (artifactPresent ? 1 : 0) : 1,
      weight: 2,
    },
    {
      name: 'task_completion_rate',
      value: completed ? 1 : 0,
      weight: 4,
    },
    {
      name: 'recovery_invocation_rate',
      value: input.recovery_invoked ? 1 : 0,
      weight: 1,
      details: 'This metric is descriptive; lower is usually better.',
    },
  ];

  return {
    completed,
    summary: buildSummary({
      evaluator: 'task_outcome',
      metrics,
      issues,
      signals: [
        {
          name: 'task_label',
          status: completed ? 'positive' : 'negative',
          details: input.task_label,
        },
      ],
      notes: ['Represents completion at the task boundary rather than sound quality.'],
    }),
  };
}
