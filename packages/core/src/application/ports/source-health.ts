import type {
  SourceAccessStatus,
  SourceAccessType,
} from "./source-access-detector.js";

export interface SourceHealthSnapshot {
  readonly sourceId: string;
  readonly domain: string;

  readonly totalAttempts: number;
  readonly successfulAttempts: number;
  readonly failedAttempts: number;

  readonly loginRequiredCount: number;
  readonly subscriptionRequiredCount: number;
  readonly paywallCount: number;
  readonly captchaCount: number;
  readonly botBlockedCount: number;
  readonly rateLimitedCount: number;
  readonly networkUnavailableCount: number;
  readonly serverErrorCount: number;
  readonly partialContentCount: number;

  readonly lastAccessStatus: SourceAccessStatus | null;
  readonly lastAccessType: SourceAccessType | null;
  readonly lastScraperId: string | null;

  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;

  readonly scraperStats: readonly SourceScraperHealth[];
}

export interface SourceScraperHealth {
  readonly scraperId: string;
  readonly accessType: SourceAccessType;

  readonly totalAttempts: number;
  readonly successfulAttempts: number;
  readonly failedAttempts: number;

  readonly successRate: number;

  readonly lastAccessStatus: SourceAccessStatus | null;
  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
}

export interface SourceHealthStore {
  recordAccess(input: SourceHealthAccessRecord): Promise<void>;

  get(sourceId: string): Promise<SourceHealthSnapshot | null>;

  getByDomain(domain: string): Promise<SourceHealthSnapshot | null>;

  getAll(): Promise<readonly SourceHealthSnapshot[]>;
}

export interface SourceHealthAccessRecord {
  readonly sourceId: string;
  readonly domain: string;
  readonly scraperId: string;
  readonly accessType: SourceAccessType;
  readonly status: SourceAccessStatus;
  readonly success: boolean;
  readonly occurredAt: string;
}
