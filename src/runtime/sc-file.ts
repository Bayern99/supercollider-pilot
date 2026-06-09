import fs from 'fs';

export function readScdFile(filePath: string): string {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }
  if (!stat.isFile()) {
    throw new Error(`Path is not a regular file: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}
