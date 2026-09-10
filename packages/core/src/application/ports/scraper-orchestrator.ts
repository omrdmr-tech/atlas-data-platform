import type { ScrapeRequest, ScrapeResult } from "./scraper.js";

export type ScraperFailureReason =
  | "blocked"
  | "rate-limited"
  | "server-error"
  | "timeout"
  | "network-error"
  | "http-error"
  | "unknown";

export interface ScraperFailure {
  readonly scraperId: string;
  readonly reason: ScraperFailureReason;
  readonly statusCode: number | null;
  readonly error: unknown;
}

export type ScraperAttemptStatus = "success" | "failed";

export interface ScraperAttemptTrace {
  readonly attempt: number;
  readonly scraperId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly status: ScraperAttemptStatus;
  readonly failureReason?: ScraperFailureReason;
  readonly statusCode?: number | null;
  readonly error?: string;
}

export interface ScraperOrchestrationResult {
  readonly result: ScrapeResult;
  readonly scraperId: string;
  readonly failures: readonly ScraperFailure[];
  readonly attemptHistory: readonly ScraperAttemptTrace[];
}

export interface ScraperOrchestrator {
  execute(
    request: ScrapeRequest
  ): Promise<ScraperOrchestrationResult>;
}