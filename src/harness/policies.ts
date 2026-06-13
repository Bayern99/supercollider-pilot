import { PilotAction } from '../runtime/driver-types.js';
import { PilotTaskTag } from './task-tags.js';

export interface TaskPolicy {
  allowed_terminal_actions: PilotAction[];
  description: string;
  requires_render_artifact: boolean;
  requires_review_note: boolean;
  requires_scd_source: boolean;
  task_tag: PilotTaskTag;
}

export const PILOT_TASK_POLICIES: Record<PilotTaskTag, TaskPolicy> = {
  'sc-audio-generation': {
    task_tag: 'sc-audio-generation',
    description:
      'Structured audio-generation tasks must end in render or render_nrt, preserve a .scd source, and produce a verifiable artifact.',
    allowed_terminal_actions: ['render', 'render_nrt'],
    requires_render_artifact: true,
    requires_review_note: true,
    requires_scd_source: true,
  },
  'sc-probe': {
    task_tag: 'sc-probe',
    description:
      'Probe tasks validate ideas or runtime behavior through Pilot, but do not require a final render artifact.',
    allowed_terminal_actions: [],
    requires_render_artifact: false,
    requires_review_note: false,
    requires_scd_source: false,
  },
  'sc-render-review': {
    task_tag: 'sc-render-review',
    description:
      'Render-review tasks require a draft or NRT render artifact so the result can be inspected and reviewed.',
    allowed_terminal_actions: ['render', 'render_nrt'],
    requires_render_artifact: true,
    requires_review_note: true,
    requires_scd_source: false,
  },
};

export function getTaskPolicy(taskTag: PilotTaskTag | null): TaskPolicy | null {
  if (!taskTag) {
    return null;
  }

  return PILOT_TASK_POLICIES[taskTag];
}
