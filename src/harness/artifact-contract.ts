import { DriverResult, RenderArtifact } from '../runtime/driver-types.js';
import { PilotTaskTag } from './task-tags.js';
import { getTaskPolicy } from './policies.js';

export function requiresRenderArtifact(taskTag: PilotTaskTag | null): boolean {
  return getTaskPolicy(taskTag)?.requires_render_artifact ?? false;
}

export function requiresScdSource(taskTag: PilotTaskTag | null): boolean {
  return getTaskPolicy(taskTag)?.requires_scd_source ?? false;
}

export function isRenderArtifactComplete(
  result: DriverResult<RenderArtifact>,
): boolean {
  const artifact = result.artifact;
  if (!artifact) {
    return false;
  }

  const verification = artifact.verification;
  if (!verification) {
    return artifact.bytes > 0;
  }

  return (
    verification.exists &&
    verification.non_empty &&
    verification.stop_completed &&
    !verification.output_error_detected &&
    verification.failure_reasons.length === 0
  );
}
