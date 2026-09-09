import type {
  SourceHealthSnapshot,
  SourceScraperHealth,
} from "./source-health.js";

export interface SourceReliabilityScore {
  readonly sourceId: string;
  readonly scraperId: string;
  readonly score: number;
  readonly successRate: number;
  readonly historyConfidence: number;
  readonly recencyWeight: number;
  readonly effectiveAttempts: number;
  readonly lastAttemptAt: string | null;
}

export interface SourceReliabilityScorer {
  score(
    source: SourceHealthSnapshot,
    scraper: SourceScraperHealth
  ): SourceReliabilityScore;
}