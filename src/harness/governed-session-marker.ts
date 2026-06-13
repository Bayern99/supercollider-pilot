import fs from 'fs';
import path from 'path';

export interface GovernedSessionMarker {
  final_nrt: boolean;
  task_id: string;
  prepared_at: string;
}

export function writeGovernedSessionMarker(
  repoRoot: string,
  info: Pick<GovernedSessionMarker, 'final_nrt' | 'task_id'>,
): void {
  const dir = path.join(repoRoot, '.scctl');
  fs.mkdirSync(dir, { recursive: true });
  const marker: GovernedSessionMarker = {
    ...info,
    prepared_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'governed-role'), `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
}

export function readGovernedSessionMarker(repoRoot: string): GovernedSessionMarker | null {
  const markerPath = path.join(repoRoot, '.scctl', 'governed-role');
  if (!fs.existsSync(markerPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(markerPath, 'utf8')) as GovernedSessionMarker;
  } catch {
    return null;
  }
}
