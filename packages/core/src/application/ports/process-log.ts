import type { ScraperFailureReason } from "./scraper-orchestrator.js";

export type ProcessLogStatus =
  | "success"
  | "failed";

export interface ProcessLogEntry {
  readonly requestId: string;
  readonly sourceId: string;
  readonly url: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly scraperId: string;
  readonly attempt: number;
  readonly durationMs: number;
  readonly status: ProcessLogStatus;
  readonly failureReason?: ScraperFailureReason;
  readonly fallbackUsed: boolean;
  readonly error?: string;
}

export interface ProcessLog {
  append(entry: ProcessLogEntry): Promise<void>;
  getAll(): readonly ProcessLogEntry[];
  findByRequestId(requestId: string): readonly ProcessLogEntry[];
}
