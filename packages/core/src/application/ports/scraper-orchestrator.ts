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

export interface ScraperOrchestrationResult {
  readonly result: ScrapeResult;
  readonly scraperId: string;
  readonly failures: readonly ScraperFailure[];
}

export interface ScraperOrchestrator {
  execute(
    request: ScrapeRequest
  ): Promise<ScraperOrchestrationResult>;
}
