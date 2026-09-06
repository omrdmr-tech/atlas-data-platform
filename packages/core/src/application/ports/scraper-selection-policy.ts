import type { ScrapeRequest, Scraper } from "./scraper.js";
import type { ScraperFailure } from "./scraper-orchestrator.js";

export interface ScraperSelectionPolicy {
  select(
    request: ScrapeRequest,
    candidates: readonly Scraper[],
    failures: readonly ScraperFailure[]
  ): readonly Scraper[];
}
