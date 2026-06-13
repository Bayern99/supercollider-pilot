import { ArchiveStore } from '../archive/archive-store.js';
import { ArchiveRecord } from '../archive/archive-types.js';
import {
  CandidateLifecycleEvent,
  CandidateReviewNote,
  CandidateStatus,
  PrimitiveCandidate,
  ProbeArtifactRef,
} from './lab-types.js';
import { createReviewNote } from './candidate-review.js';

interface CandidateLifecyclePayload {
  candidate_id: string;
  name?: string;
  source_probe_id?: string;
  artifacts?: ProbeArtifactRef[];
  event: CandidateLifecycleEvent;
}

interface CandidateReviewPayload {
  candidate_id: string;
  review: CandidateReviewNote;
}

interface CreateCandidateInput {
  candidate_id: string;
  name: string;
  source_probe_id: string;
  session_id: string;
  artifacts?: ProbeArtifactRef[];
  metadata?: Record<string, unknown>;
  summary?: string;
}

function now(): string {
  return new Date().toISOString();
}

function cloneCandidate(candidate: PrimitiveCandidate): PrimitiveCandidate {
  return {
    ...candidate,
    artifacts: [...candidate.artifacts],
    reviews: [...candidate.reviews],
    history: [...candidate.history],
    metadata: { ...candidate.metadata },
  };
}

export class CandidateRegistry {
  constructor(private readonly archive: ArchiveStore) {}

  public async createDraft(input: CreateCandidateInput): Promise<PrimitiveCandidate> {
    await this.appendLifecycle(input.session_id, {
      candidate_id: input.candidate_id,
      name: input.name,
      source_probe_id: input.source_probe_id,
      artifacts: input.artifacts ?? [],
      event: {
        candidate_id: input.candidate_id,
        action: 'create',
        from_status: null,
        to_status: 'draft',
        summary: input.summary ?? 'Created draft candidate.',
        created_at: now(),
        metadata: input.metadata,
      },
    });

    return this.getCandidate(input.candidate_id);
  }

  public async promote(sessionId: string, candidateId: string, summary: string): Promise<PrimitiveCandidate> {
    return this.transition(sessionId, candidateId, 'promote', 'candidate', summary);
  }

  public async accept(sessionId: string, candidateId: string, summary: string): Promise<PrimitiveCandidate> {
    return this.transition(sessionId, candidateId, 'accept', 'accepted', summary);
  }

  public async reject(sessionId: string, candidateId: string, summary: string): Promise<PrimitiveCandidate> {
    return this.transition(sessionId, candidateId, 'reject', 'rejected', summary);
  }

  public async revisit(sessionId: string, candidateId: string, summary: string): Promise<PrimitiveCandidate> {
    return this.transition(sessionId, candidateId, 'revisit', 'revisit', summary);
  }

  public async rename(
    sessionId: string,
    candidateId: string,
    nextName: string,
    summary: string,
  ): Promise<PrimitiveCandidate> {
    if (!nextName.trim()) {
      throw new Error('Candidate rename requires a non-empty name.');
    }

    return this.transition(sessionId, candidateId, 'rename', null, summary, {
      renamed_to: nextName,
    });
  }

  public async split(
    sessionId: string,
    candidateId: string,
    splitInto: string[],
    summary: string,
  ): Promise<PrimitiveCandidate> {
    if (splitInto.length === 0) {
      throw new Error('Candidate split requires at least one target.');
    }

    return this.transition(sessionId, candidateId, 'split', 'revisit', summary, {
      split_into: splitInto,
    });
  }

  public async merge(
    sessionId: string,
    candidateId: string,
    mergedFrom: string[],
    summary: string,
  ): Promise<PrimitiveCandidate> {
    if (mergedFrom.length === 0) {
      throw new Error('Candidate merge requires at least one source.');
    }

    return this.transition(sessionId, candidateId, 'merge', 'candidate', summary, {
      merged_from: mergedFrom,
    });
  }

  public async deprecate(
    sessionId: string,
    candidateId: string,
    supersededBy: string[],
    summary: string,
  ): Promise<PrimitiveCandidate> {
    return this.transition(sessionId, candidateId, 'deprecate', 'rejected', summary, {
      superseded_by: supersededBy,
      deprecated_at: now(),
    });
  }

  public async addReview(
    sessionId: string,
    candidateId: string,
    note: CandidateReviewNote,
  ): Promise<PrimitiveCandidate> {
    const candidate = await this.getCandidate(candidateId);
    const review = createReviewNote(note);

    await this.archive.append<CandidateReviewPayload>({
      kind: 'review_note',
      session_id: sessionId,
      payload: {
        candidate_id: candidate.id,
        review,
      },
      created_at: review.created_at,
    });

    return this.getCandidate(candidateId);
  }

  public async getCandidate(candidateId: string): Promise<PrimitiveCandidate> {
    const candidates = await this.listCandidates();
    const match = candidates.find((candidate) => candidate.id === candidateId);
    if (!match) {
      throw new Error(`Unknown candidate: ${candidateId}`);
    }

    return cloneCandidate(match);
  }

  public async listCandidates(): Promise<PrimitiveCandidate[]> {
    const [lifecycleRecords, reviewRecords] = await Promise.all([
      this.archive.listByKind<CandidateLifecyclePayload>('candidate_lifecycle'),
      this.archive.listByKind<CandidateReviewPayload>('review_note'),
    ]);

    const candidates = new Map<string, PrimitiveCandidate>();

    for (const record of lifecycleRecords) {
      this.applyLifecycleRecord(candidates, record);
    }

    for (const record of reviewRecords) {
      const candidate = candidates.get(record.payload.candidate_id);
      if (!candidate) {
        continue;
      }

      candidate.reviews.push(record.payload.review);
      candidate.updated_at = record.created_at;
    }

    return [...candidates.values()]
      .map((candidate) => cloneCandidate(candidate))
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
  }

  private async transition(
    sessionId: string,
    candidateId: string,
    action: CandidateLifecycleEvent['action'],
    nextStatus: CandidateStatus | null,
    summary: string,
    metadata?: Record<string, unknown>,
  ): Promise<PrimitiveCandidate> {
    const candidate = await this.getCandidate(candidateId);

    await this.appendLifecycle(sessionId, {
      candidate_id: candidate.id,
      event: {
        candidate_id: candidate.id,
        action,
        from_status: candidate.status,
        to_status: nextStatus ?? candidate.status,
        summary,
        created_at: now(),
        metadata,
      },
    });

    return this.getCandidate(candidateId);
  }

  private async appendLifecycle(
    sessionId: string,
    payload: CandidateLifecyclePayload,
  ): Promise<void> {
    await this.archive.append<CandidateLifecyclePayload>({
      kind: 'candidate_lifecycle',
      session_id: sessionId,
      payload,
      created_at: payload.event.created_at,
    });
  }

  private applyLifecycleRecord(
    candidates: Map<string, PrimitiveCandidate>,
    record: ArchiveRecord<CandidateLifecyclePayload>,
  ): void {
    const { payload } = record;
    let candidate = candidates.get(payload.candidate_id);

    if (!candidate) {
      if (payload.event.action !== 'create' || !payload.name || !payload.source_probe_id) {
        return;
      }

      candidate = {
        id: payload.candidate_id,
        name: payload.name,
        status: payload.event.to_status,
        source_probe_id: payload.source_probe_id,
        created_at: record.created_at,
        updated_at: record.created_at,
        artifacts: [...(payload.artifacts ?? [])],
        reviews: [],
        history: [],
        metadata: { ...(payload.event.metadata ?? {}) },
      };
      candidates.set(candidate.id, candidate);
    }

    candidate.status = payload.event.to_status;
    candidate.updated_at = record.created_at;
    candidate.history.push(payload.event);

    if (payload.event.action === 'rename') {
      candidate.name = String(payload.event.metadata?.renamed_to ?? candidate.name);
    }

    if (payload.event.action === 'split') {
      candidate.split_into = [...(payload.event.metadata?.split_into as string[] | undefined ?? [])];
    }

    if (payload.event.action === 'merge') {
      candidate.merged_from = [...(payload.event.metadata?.merged_from as string[] | undefined ?? [])];
    }

    if (payload.event.action === 'deprecate') {
      candidate.superseded_by = [...(payload.event.metadata?.superseded_by as string[] | undefined ?? [])];
      candidate.deprecated_at = payload.event.metadata?.deprecated_at as string | undefined;
    }
  }
}
