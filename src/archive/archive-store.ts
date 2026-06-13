import { promises as fs } from 'fs';
import path from 'path';
import {
  ArchiveAppendInput,
  ArchiveMemorySummary,
  ArchiveMemorySummaryOptions,
  ArchiveRecord,
  ArchiveRecordKind,
} from './archive-types.js';
import { buildArchiveMemorySummary } from './memory-summary.js';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

export class ArchiveStore {
  private readonly rootDir: string;
  private readonly logFile: string;

  constructor(rootDir: string, logFile = 'archive-events.jsonl') {
    this.rootDir = rootDir;
    this.logFile = path.join(rootDir, logFile);
  }

  public getLogFilePath(): string {
    return this.logFile;
  }

  public getRootDir(): string {
    return this.rootDir;
  }

  public async append<TPayload>(input: ArchiveAppendInput<TPayload>): Promise<ArchiveRecord<TPayload>> {
    await fs.mkdir(this.rootDir, { recursive: true });

    const record: ArchiveRecord<TPayload> = {
      id: input.id ?? makeId(input.kind),
      kind: input.kind,
      session_id: input.session_id,
      created_at: input.created_at ?? new Date().toISOString(),
      payload: input.payload,
    };

    await fs.appendFile(this.logFile, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  public async readAll(): Promise<ArchiveRecord[]> {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as ArchiveRecord);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }

      throw err;
    }
  }

  public async listByKind<TPayload>(kind: ArchiveRecordKind): Promise<ArchiveRecord<TPayload>[]> {
    const records = await this.readAll();
    return records.filter((record) => record.kind === kind) as ArchiveRecord<TPayload>[];
  }

  public async listBySession<TPayload>(sessionId: string): Promise<ArchiveRecord<TPayload>[]> {
    const records = await this.readAll();
    return records.filter((record) => record.session_id === sessionId) as ArchiveRecord<TPayload>[];
  }

  public async buildMemorySummary(options: ArchiveMemorySummaryOptions = {}): Promise<ArchiveMemorySummary> {
    const records = await this.readAll();
    return buildArchiveMemorySummary(records, options);
  }
}
