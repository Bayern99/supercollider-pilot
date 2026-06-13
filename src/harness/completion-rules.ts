import {
  ComplianceSnapshot,
  DriverResult,
  PilotAction,
  PilotRouteSurface,
  PilotSourceKind,
  RenderArtifact,
} from '../runtime/driver-types.js';
import {
  isRenderArtifactComplete,
  requiresRenderArtifact,
  requiresScdSource,
} from './artifact-contract.js';
import { getTaskPolicy } from './policies.js';
import { normalizeTaskTag } from './task-tags.js';

export interface CompletionEvaluationInput {
  action: PilotAction;
  result: DriverResult<RenderArtifact>;
  sourceKind: PilotSourceKind;
  sourcePath?: string | null;
  surface: PilotRouteSurface;
  taskTag?: unknown;
}

export function evaluateCompletion(
  input: CompletionEvaluationInput,
): ComplianceSnapshot {
  const normalizedTag = normalizeTaskTag(input.taskTag);
  const providedTag =
    typeof input.taskTag === 'string' && input.taskTag.trim()
      ? input.taskTag.trim()
      : null;
  const policy = getTaskPolicy(normalizedTag);
  const requiresArtifact = requiresRenderArtifact(normalizedTag);
  const requiresSource = requiresScdSource(normalizedTag);
  const artifactComplete = isRenderArtifactComplete(input.result);
  const reasons: string[] = [];

  if (providedTag && !normalizedTag) {
    reasons.push(`Unsupported task tag: ${providedTag}.`);
  }
  if (!providedTag) {
    reasons.push('No task tag was provided, so completion enforcement was skipped.');
  }
  if (normalizedTag && !input.result.success) {
    reasons.push(
      `Pilot action failed before completion checks passed (${input.result.error_kind ?? 'unknown_error'}).`,
    );
  }
  if (
    policy?.allowed_terminal_actions.length &&
    !policy.allowed_terminal_actions.includes(input.action)
  ) {
    reasons.push(
      `${policy.task_tag} tasks must end with one of: ${policy.allowed_terminal_actions.join(', ')}.`,
    );
  }
  if (requiresSource && input.sourceKind !== 'scd_file') {
    reasons.push('This task requires a .scd source path routed through Pilot.');
  }
  if (requiresArtifact && !artifactComplete) {
    reasons.push('A valid non-empty render artifact is required for this task.');
  }
  if (
    normalizedTag &&
    input.sourceKind === 'scd_file' &&
    (!input.sourcePath || !input.sourcePath.trim())
  ) {
    reasons.push('Source kind was marked as scd_file but no source path was recorded.');
  }

  const status =
    !providedTag
      ? 'not_applicable'
      : reasons.length > 0
        ? 'failed'
        : 'passed';

  if (status === 'passed') {
    reasons.push('Pilot route and completion requirements were satisfied.');
  }

  return {
    artifact_complete: artifactComplete,
    reasons,
    requires_render_artifact: requiresArtifact,
    requires_source: requiresSource,
    route: {
      action: input.action,
      source_kind: input.sourceKind,
      source_path: input.sourcePath?.trim() ? input.sourcePath : null,
      surface: input.surface,
    },
    status,
    task_tag: normalizedTag ?? providedTag,
    /** True when the call went through a Pilot CLI/MCP surface; not proof against external side paths. */
    used_pilot: true,
  };
}
