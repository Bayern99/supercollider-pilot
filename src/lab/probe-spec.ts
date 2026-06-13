import { ProbeSpec } from './lab-types.js';

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateProbeSpec(spec: ProbeSpec): string[] {
  const errors: string[] = [];

  if (!hasText(spec.id)) {
    errors.push('Probe spec requires a non-empty id.');
  }

  if (!hasText(spec.title)) {
    errors.push('Probe spec requires a non-empty title.');
  }

  if (!hasText(spec.question)) {
    errors.push('Probe spec requires a non-empty question.');
  }

  if (!Array.isArray(spec.tags) || spec.tags.length === 0) {
    errors.push('Probe spec requires at least one tag.');
  }

  if (spec.mode === 'eval' && !hasText(spec.code)) {
    errors.push('Eval probes require code.');
  }

  if (spec.mode === 'run_file' && !hasText(spec.file_path)) {
    errors.push('Run-file probes require file_path.');
  }

  if (spec.mode === 'render') {
    if (!hasText(spec.code) && !hasText(spec.file_path)) {
      errors.push('Render probes require code or file_path.');
    }

    if (!spec.render) {
      errors.push('Render probes require render options.');
    } else {
      if (
        typeof spec.render.duration_sec !== 'number' ||
        !Number.isFinite(spec.render.duration_sec) ||
        !(spec.render.duration_sec > 0)
      ) {
        errors.push('Render probes require a positive render.duration_sec.');
      }

      if (!hasText(spec.render.out_path)) {
        errors.push('Render probes require render.out_path.');
      }
    }
  }

  if (spec.mode === 'render_nrt') {
    if (!hasText(spec.file_path)) {
      errors.push('Render-NRT probes require file_path.');
    }

    if (!spec.render) {
      errors.push('Render-NRT probes require render options.');
    } else {
      if (
        typeof spec.render.duration_sec !== 'undefined' &&
        (
          typeof spec.render.duration_sec !== 'number' ||
          !Number.isFinite(spec.render.duration_sec) ||
          !(spec.render.duration_sec > 0)
        )
      ) {
        errors.push('Render-NRT probes require render.duration_sec to be positive when present.');
      }

      if (!hasText(spec.render.out_path)) {
        errors.push('Render-NRT probes require render.out_path.');
      }
    }
  }

  return errors;
}

export function assertValidProbeSpec(spec: ProbeSpec): void {
  const errors = validateProbeSpec(spec);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}
