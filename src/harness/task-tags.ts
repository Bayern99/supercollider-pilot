export const PILOT_TASK_TAGS = [
  'sc-audio-generation',
  'sc-probe',
  'sc-render-review',
] as const;

export type PilotTaskTag = (typeof PILOT_TASK_TAGS)[number];

export function isPilotTaskTag(value: string): value is PilotTaskTag {
  return (PILOT_TASK_TAGS as readonly string[]).includes(value);
}

export function normalizeTaskTag(value: unknown): PilotTaskTag | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return isPilotTaskTag(normalized) ? normalized : null;
}
