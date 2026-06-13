import {
  type ScExecutionMode,
  type ScSpec,
  type ScTaskLabel,
  type WorkflowKind,
} from './sc-spec-schema.js';
import type { RenderTier } from '../runtime/driver-types.js';

export interface WorkflowSelectionInput {
  task_label?: ScTaskLabel;
  requested_outcome?: 'explore' | 'refine' | 'review' | 'promote';
  has_reference_patch?: boolean;
  has_render_artifact?: boolean;
  has_candidate?: boolean;
  requires_review?: boolean;
  quality_tier?: RenderTier;
  spec?: Partial<ScSpec>;
}

export interface WorkflowSelection {
  workflow: WorkflowKind;
  confidence: 'high' | 'medium';
  reasons: string[];
  recommended_execution_mode: ScExecutionMode;
  recommended_tools: string[];
  primary_role: 'manager' | 'builder' | 'evaluator';
}

export function selectWorkflow(
  input: WorkflowSelectionInput,
): WorkflowSelection {
  const reasons: string[] = [];
  const finalNrtRequested =
    input.quality_tier === 'final_nrt'
    || input.spec?.quality?.render_tier === 'final_nrt'
    || input.spec?.execution?.mode === 'render_nrt';

  if (input.spec?.workflow) {
    reasons.push(`Spec requested workflow ${input.spec.workflow}.`);
    return selectionForWorkflow(input.spec.workflow, reasons, 'high', finalNrtRequested);
  }

  if (input.has_candidate || input.requested_outcome === 'promote') {
    reasons.push('Candidate context is present, so promotion review is the primary job.');
    return selectionForWorkflow('candidate_promotion', reasons, 'high', finalNrtRequested);
  }

  if (
    input.has_render_artifact ||
    input.requires_review ||
    input.task_label === 'sc-render-review' ||
    input.requested_outcome === 'review'
  ) {
    reasons.push('Render artifact or review gate is present, so render QA should run first.');
    return selectionForWorkflow('render_qa', reasons, 'high', finalNrtRequested);
  }

  if (
    input.has_reference_patch ||
    input.requested_outcome === 'refine' ||
    input.spec?.context?.patch_path
  ) {
    reasons.push('Reference patch context exists, so refinement is more appropriate than free exploration.');
    return selectionForWorkflow('patch_refinement', reasons, 'medium', finalNrtRequested);
  }

  reasons.push('No candidate, review artifact, or patch anchor was supplied, so start with a probe.');
  return selectionForWorkflow('probe', reasons, 'medium', finalNrtRequested);
}

function selectionForWorkflow(
  workflow: WorkflowKind,
  reasons: string[],
  confidence: 'high' | 'medium',
  finalNrtRequested: boolean,
): WorkflowSelection {
  const recommendedExecutionMode: ScExecutionMode =
    finalNrtRequested && (workflow === 'render_qa' || workflow === 'candidate_promotion')
      ? 'render_nrt'
      : workflow === 'render_qa'
      ? 'render'
      : workflow === 'patch_refinement'
        ? 'run_file'
        : workflow === 'candidate_promotion'
          ? 'render'
          : 'eval';

  const primaryRole =
    workflow === 'render_qa' || workflow === 'candidate_promotion'
      ? 'evaluator'
      : workflow === 'probe'
        ? 'builder'
        : 'manager';

  return {
    workflow,
    confidence,
    reasons,
    recommended_execution_mode: recommendedExecutionMode,
    recommended_tools: workflowToolsFor(workflow, finalNrtRequested),
    primary_role: primaryRole,
  };
}

function workflowToolsFor(
  workflow: WorkflowKind,
  finalNrtRequested: boolean,
): string[] {
  if (workflow === 'probe') {
    return ['sc_check', 'sc_eval', 'sc_logs'];
  }
  if (workflow === 'patch_refinement') {
    return ['sc_status', 'sc_run_file', 'sc_eval', 'sc_logs'];
  }
  if (workflow === 'render_qa') {
    return [finalNrtRequested ? 'sc_render_nrt' : 'sc_render', 'sc_logs', 'artifact_review'];
  }
  if (workflow === 'candidate_promotion') {
    return finalNrtRequested
      ? ['sc_render_nrt', 'candidate_review', 'memory_summary']
      : ['candidate_review', 'memory_summary'];
  }

  return ['sc_logs'];
}
