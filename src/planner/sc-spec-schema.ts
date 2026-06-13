import path from 'path';
import type {
  EnginePreference,
  RenderTier,
  RequestedSampleFormat,
} from '../runtime/driver-types.js';

export const SC_SPEC_SCHEMA_VERSION = '0.1.0';

export const WORKFLOW_KINDS = [
  'probe',
  'patch_refinement',
  'render_qa',
  'candidate_promotion',
] as const;

export type WorkflowKind = (typeof WORKFLOW_KINDS)[number];

export const SC_TASK_LABELS = [
  'sc-audio-generation',
  'sc-probe',
  'sc-render-review',
] as const;

export type ScTaskLabel = (typeof SC_TASK_LABELS)[number];

export const EXECUTION_MODES = ['eval', 'run_file', 'render', 'render_nrt'] as const;

export type ScExecutionMode = (typeof EXECUTION_MODES)[number];

export interface ScQualitySpec {
  render_tier?: RenderTier;
  engine_preference?: EnginePreference;
  sample_format?: RequestedSampleFormat;
}

export interface ScSpec {
  schema_version: typeof SC_SPEC_SCHEMA_VERSION;
  title: string;
  task_label: ScTaskLabel;
  workflow: WorkflowKind;
  intent: {
    prompt: string;
    goals: string[];
    constraints: string[];
    references?: string[];
  };
  sound: {
    timbre_keywords: string[];
    structure?: string;
    duration_sec?: number;
  };
  execution: {
    mode: ScExecutionMode;
    code?: string;
    file_path?: string;
  };
  evaluation: {
    success_signals: string[];
    rejection_signals?: string[];
    must_use_pilot_tools?: boolean;
  };
  quality?: ScQualitySpec;
  context?: {
    parent_probe_id?: string;
    patch_path?: string;
    render_path?: string;
    candidate_id?: string;
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ScSpecValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function includesLiteral<T extends string>(
  literals: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && literals.includes(value as T);
}

export function validateScSpec(value: unknown): ScSpecValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isPlainObject(value)) {
    return {
      ok: false,
      issues: [{ path: '$', message: 'SC spec must be a plain object.' }],
    };
  }

  if (value.schema_version !== SC_SPEC_SCHEMA_VERSION) {
    issues.push({
      path: '$.schema_version',
      message: `Expected schema_version ${SC_SPEC_SCHEMA_VERSION}.`,
    });
  }

  if (!isNonEmptyString(value.title)) {
    issues.push({ path: '$.title', message: 'title must be a non-empty string.' });
  }

  if (!includesLiteral(SC_TASK_LABELS, value.task_label)) {
    issues.push({
      path: '$.task_label',
      message: `task_label must be one of ${SC_TASK_LABELS.join(', ')}.`,
    });
  }

  if (!includesLiteral(WORKFLOW_KINDS, value.workflow)) {
    issues.push({
      path: '$.workflow',
      message: `workflow must be one of ${WORKFLOW_KINDS.join(', ')}.`,
    });
  }

  if (!isPlainObject(value.intent)) {
    issues.push({ path: '$.intent', message: 'intent must be an object.' });
  } else {
    if (!isNonEmptyString(value.intent.prompt)) {
      issues.push({
        path: '$.intent.prompt',
        message: 'intent.prompt must be a non-empty string.',
      });
    }
    if (!isStringArray(value.intent.goals)) {
      issues.push({
        path: '$.intent.goals',
        message: 'intent.goals must be an array of non-empty strings.',
      });
    }
    if (!isStringArray(value.intent.constraints)) {
      issues.push({
        path: '$.intent.constraints',
        message: 'intent.constraints must be an array of non-empty strings.',
      });
    }
    if (
      typeof value.intent.references !== 'undefined' &&
      !isStringArray(value.intent.references)
    ) {
      issues.push({
        path: '$.intent.references',
        message: 'intent.references must be an array of non-empty strings when present.',
      });
    }
  }

  if (!isPlainObject(value.sound)) {
    issues.push({ path: '$.sound', message: 'sound must be an object.' });
  } else {
    if (!isStringArray(value.sound.timbre_keywords)) {
      issues.push({
        path: '$.sound.timbre_keywords',
        message: 'sound.timbre_keywords must be an array of non-empty strings.',
      });
    }
    const durationSec = value.sound.duration_sec;
    if (
      typeof durationSec !== 'undefined' &&
      (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0)
    ) {
      issues.push({
        path: '$.sound.duration_sec',
        message: 'sound.duration_sec must be a positive number when present.',
      });
    }
  }

  if (!isPlainObject(value.execution)) {
    issues.push({ path: '$.execution', message: 'execution must be an object.' });
  } else {
    if (!includesLiteral(EXECUTION_MODES, value.execution.mode)) {
      issues.push({
        path: '$.execution.mode',
        message: `execution.mode must be one of ${EXECUTION_MODES.join(', ')}.`,
      });
    }
    if (value.execution.mode === 'eval' && !isNonEmptyString(value.execution.code)) {
      issues.push({
        path: '$.execution.code',
        message: 'execution.code is required when mode is eval.',
      });
    }
    if (
      value.execution.mode === 'run_file' &&
      !isNonEmptyString(value.execution.file_path)
    ) {
      issues.push({
        path: '$.execution.file_path',
        message: 'execution.file_path is required when mode is run_file.',
      });
    }
    if (
      value.execution.mode === 'render' &&
      !isNonEmptyString(value.execution.code) &&
      !isNonEmptyString(value.execution.file_path)
    ) {
      issues.push({
        path: '$.execution',
        message: 'render mode requires execution.code or execution.file_path.',
      });
    }
    if (value.execution.mode === 'render_nrt') {
      if (!isNonEmptyString(value.execution.file_path)) {
        issues.push({
          path: '$.execution.file_path',
          message: 'render_nrt mode requires execution.file_path.',
        });
      } else {
        if (!path.isAbsolute(value.execution.file_path)) {
          issues.push({
            path: '$.execution.file_path',
            message: 'render_nrt mode requires an absolute execution.file_path.',
          });
        }
        if (!value.execution.file_path.toLowerCase().endsWith('.scd')) {
          issues.push({
            path: '$.execution.file_path',
            message: 'render_nrt mode requires a .scd execution.file_path.',
          });
        }
      }
    }
  }

  if (!isPlainObject(value.evaluation)) {
    issues.push({ path: '$.evaluation', message: 'evaluation must be an object.' });
  } else {
    if (!isStringArray(value.evaluation.success_signals)) {
      issues.push({
        path: '$.evaluation.success_signals',
        message: 'evaluation.success_signals must be an array of non-empty strings.',
      });
    }
    if (
      typeof value.evaluation.rejection_signals !== 'undefined' &&
      !isStringArray(value.evaluation.rejection_signals)
    ) {
      issues.push({
        path: '$.evaluation.rejection_signals',
        message:
          'evaluation.rejection_signals must be an array of non-empty strings when present.',
      });
    }
  }

  if (typeof value.quality !== 'undefined') {
    if (!isPlainObject(value.quality)) {
      issues.push({ path: '$.quality', message: 'quality must be an object when present.' });
    } else {
      if (
        typeof value.quality.render_tier !== 'undefined' &&
        value.quality.render_tier !== 'draft' &&
        value.quality.render_tier !== 'final_nrt'
      ) {
        issues.push({
          path: '$.quality.render_tier',
          message: 'quality.render_tier must be draft or final_nrt when present.',
        });
      }
      if (
        typeof value.quality.engine_preference !== 'undefined' &&
        !['auto', 'scsynth', 'supernova'].includes(String(value.quality.engine_preference))
      ) {
        issues.push({
          path: '$.quality.engine_preference',
          message:
            'quality.engine_preference must be auto, scsynth, or supernova when present.',
        });
      }
      if (
        typeof value.quality.sample_format !== 'undefined' &&
        !['float', 'double'].includes(String(value.quality.sample_format))
      ) {
        issues.push({
          path: '$.quality.sample_format',
          message: 'quality.sample_format must be float or double when present.',
        });
      }
    }
  }

  if (typeof value.context !== 'undefined' && !isPlainObject(value.context)) {
    issues.push({ path: '$.context', message: 'context must be an object when present.' });
  }

  if (value.workflow === 'patch_refinement') {
    const patchPath = isPlainObject(value.context) ? value.context.patch_path : undefined;
    const parentProbeId = isPlainObject(value.context)
      ? value.context.parent_probe_id
      : undefined;
    if (!isNonEmptyString(patchPath) && !isNonEmptyString(parentProbeId)) {
      issues.push({
        path: '$.context',
        message: 'patch_refinement requires context.patch_path or context.parent_probe_id.',
      });
    }
  }

  if (value.workflow === 'render_qa') {
    const renderPath = isPlainObject(value.context) ? value.context.render_path : undefined;
    if (!isNonEmptyString(renderPath)) {
      issues.push({
        path: '$.context.render_path',
        message: 'render_qa requires context.render_path.',
      });
    }
  }

  if (value.workflow === 'candidate_promotion') {
    const candidateId = isPlainObject(value.context) ? value.context.candidate_id : undefined;
    if (!isNonEmptyString(candidateId)) {
      issues.push({
        path: '$.context.candidate_id',
        message: 'candidate_promotion requires context.candidate_id.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function isScSpec(value: unknown): value is ScSpec {
  return validateScSpec(value).ok;
}
