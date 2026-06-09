import { SclangController } from './sclang.js';

export type ServerStatus = 'running' | 'not_running' | 'unknown';

export function parseServerRunningOutput(output: string): ServerStatus {
  if (!output.trim()) {
    return 'unknown';
  }
  if (/\bfalse\b/i.test(output)) {
    return 'not_running';
  }
  if (/\btrue\b/i.test(output)) {
    return 'running';
  }
  return 'unknown';
}

export async function probeServerStatus(controller: SclangController): Promise<ServerStatus> {
  try {
    const result = await controller.execute('s.serverRunning;');
    if (!result.success) {
      return 'unknown';
    }
    return parseServerRunningOutput(result.output);
  } catch {
    return 'unknown';
  }
}

export async function probeServerWithNewController(sclangPath: string): Promise<ServerStatus> {
  const controller = new SclangController(sclangPath);
  try {
    await controller.boot();
    return await probeServerStatus(controller);
  } catch {
    return 'unknown';
  } finally {
    try {
      await controller.stop();
    } catch {
      // Ignore stop errors during probe cleanup
    }
  }
}

export function formatCheckText(sclangPath: string, serverStatus: ServerStatus): string {
  return `sclang: OK\npath: ${sclangPath}\nserver: ${serverStatus}`;
}
