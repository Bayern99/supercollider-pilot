import fs from 'fs';
import path from 'path';

export function discoverSclangPath(platform: string = process.platform): string | null {
  if (platform === 'darwin') {
    const defaultMacPath = '/Applications/SuperCollider.app/Contents/MacOS/sclang';
    if (fs.existsSync(defaultMacPath)) {
      return defaultMacPath;
    }
  } else if (platform === 'win32') {
    const defaultWinPath = 'C:\\Program Files\\SuperCollider\\sclang.exe';
    if (fs.existsSync(defaultWinPath)) {
      return defaultWinPath;
    }
  } else {
    // Linux
    const paths = ['/usr/bin/sclang', '/usr/local/bin/sclang'];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
  }

  // Fallback: check directories in system PATH
  const envPath = process.env.PATH || '';
  const pathDelimiter = platform === 'win32' ? ';' : ':';
  const exeName = platform === 'win32' ? 'sclang.exe' : 'sclang';
  for (const dir of envPath.split(pathDelimiter)) {
    if (!dir) continue;
    const fullPath = platform === 'win32' ? path.win32.join(dir, exeName) : path.posix.join(dir, exeName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}
