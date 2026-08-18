import type {
  ScrapeRequest,
  ScrapeResult,
} from "./scraper.js";

export interface ScraperFailure {
  readonly scraperId: string;
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
