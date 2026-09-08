import type {
  SourceAccessStatus,
  SourceAccessType,
} from "../../../application/ports/source-access-detector.js";

import type {
  SourceHealthAccessRecord,
  SourceHealthSnapshot,
  SourceHealthStore,
  SourceScraperHealth,
} from "../../../application/ports/source-health.js";

interface MutableScraperHealth {
  scraperId: string;
  accessType: SourceAccessType;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  lastAccessStatus: SourceAccessStatus | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

interface MutableSourceHealth {
  sourceId: string;
  domain: string;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;

  loginRequiredCount: number;
  subscriptionRequiredCount: number;
  paywallCount: number;
  captchaCount: number;
  botBlockedCount: number;
  rateLimitedCount: number;
  networkUnavailableCount: number;
  serverErrorCount: number;
  partialContentCount: number;

  lastAccessStatus: SourceAccessStatus | null;
  lastAccessType: SourceAccessType | null;
  lastScraperId: string | null;

  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;

  scrapers: Map<string, MutableScraperHealth>;
}

export class InMemorySourceHealthStore
  implements SourceHealthStore
{
  private readonly sources = new Map<
    string,
    MutableSourceHealth
  >();

  public async recordAccess(input: SourceHealthAccessRecord): Promise<void> {
    const source = this.getOrCreateSource(input);

    source.totalAttempts++;

    if (input.success) {
      source.successfulAttempts++;
      source.lastSuccessAt = input.occurredAt;
    } else {
      source.failedAttempts++;
      source.lastFailureAt = input.occurredAt;
    }

    incrementStatusCounter(source, input.status);

    source.lastAccessStatus = input.status;
    source.lastAccessType = input.accessType;
    source.lastScraperId = input.scraperId;
    source.lastAttemptAt = input.occurredAt;

    const scraper = getOrCreateScraper(
      source,
      input.scraperId,
      input.accessType
    );

    scraper.totalAttempts++;

    if (input.success) {
      scraper.successfulAttempts++;
      scraper.lastSuccessAt = input.occurredAt;
    } else {
      scraper.failedAttempts++;
      scraper.lastFailureAt = input.occurredAt;
    }

    scraper.lastAccessStatus = input.status;
    scraper.lastAttemptAt = input.occurredAt;
  }

  public async get(sourceId: string): Promise<SourceHealthSnapshot | null> {
    const source = this.sources.get(sourceId);

    if (!source) {
      return null;
    }

    return toSnapshot(source);
  }

  public async getByDomain(domain: string): Promise<SourceHealthSnapshot | null> {
    const normalizedDomain = normalizeDomain(domain);

    for (const source of this.sources.values()) {
      if (source.domain === normalizedDomain) {
        return toSnapshot(source);
      }
    }

    return null;
  }

  public async getAll(): Promise<readonly SourceHealthSnapshot[]> {
    return [...this.sources.values()]
      .map(toSnapshot);
  }

  private getOrCreateSource(
    input: SourceHealthAccessRecord
  ): MutableSourceHealth {
    const existing = this.sources.get(input.sourceId);

    if (existing) {
      return existing;
    }

    const source: MutableSourceHealth = {
      sourceId: input.sourceId,
      domain: normalizeDomain(input.domain),

      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,

      loginRequiredCount: 0,
      subscriptionRequiredCount: 0,
      paywallCount: 0,
      captchaCount: 0,
      botBlockedCount: 0,
      rateLimitedCount: 0,
      networkUnavailableCount: 0,
      serverErrorCount: 0,
      partialContentCount: 0,

      lastAccessStatus: null,
      lastAccessType: null,
      lastScraperId: null,

      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,

      scrapers: new Map(),
    };

    this.sources.set(input.sourceId, source);

    return source;
  }
}

function getOrCreateScraper(
  source: MutableSourceHealth,
  scraperId: string,
  accessType: SourceAccessType
): MutableScraperHealth {
  const existing = source.scrapers.get(scraperId);

  if (existing) {
    return existing;
  }

  const scraper: MutableScraperHealth = {
    scraperId,
    accessType,
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    lastAccessStatus: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
  };

  source.scrapers.set(scraperId, scraper);

  return scraper;
}

function incrementStatusCounter(
  source: MutableSourceHealth,
  status: SourceAccessStatus
): void {
  switch (status) {
    case "login-required":
      source.loginRequiredCount++;
      break;

    case "subscription-required":
      source.subscriptionRequiredCount++;
      break;

    case "paywall":
      source.paywallCount++;
      break;

    case "captcha":
      source.captchaCount++;
      break;

    case "bot-blocked":
      source.botBlockedCount++;
      break;

    case "rate-limited":
      source.rateLimitedCount++;
      break;

    case "network-unavailable":
      source.networkUnavailableCount++;
      break;

    case "server-error":
      source.serverErrorCount++;
      break;

    case "partial-content":
      source.partialContentCount++;
      break;

    default:
      break;
  }
}

function toSnapshot(
  source: MutableSourceHealth
): SourceHealthSnapshot {
  const scraperStats: SourceScraperHealth[] = [
    ...source.scrapers.values(),
  ].map((scraper) => ({
    scraperId: scraper.scraperId,
    accessType: scraper.accessType,
    totalAttempts: scraper.totalAttempts,
    successfulAttempts: scraper.successfulAttempts,
    failedAttempts: scraper.failedAttempts,
    successRate: calculateRate(
      scraper.successfulAttempts,
      scraper.totalAttempts
    ),
    lastAccessStatus: scraper.lastAccessStatus,
    lastAttemptAt: scraper.lastAttemptAt,
    lastSuccessAt: scraper.lastSuccessAt,
    lastFailureAt: scraper.lastFailureAt,
  }));

  return {
    sourceId: source.sourceId,
    domain: source.domain,

    totalAttempts: source.totalAttempts,
    successfulAttempts: source.successfulAttempts,
    failedAttempts: source.failedAttempts,

    loginRequiredCount: source.loginRequiredCount,
    subscriptionRequiredCount:
      source.subscriptionRequiredCount,
    paywallCount: source.paywallCount,
    captchaCount: source.captchaCount,
    botBlockedCount: source.botBlockedCount,
    rateLimitedCount: source.rateLimitedCount,
    networkUnavailableCount:
      source.networkUnavailableCount,
    serverErrorCount: source.serverErrorCount,
    partialContentCount: source.partialContentCount,

    lastAccessStatus: source.lastAccessStatus,
    lastAccessType: source.lastAccessType,
    lastScraperId: source.lastScraperId,

    lastAttemptAt: source.lastAttemptAt,
    lastSuccessAt: source.lastSuccessAt,
    lastFailureAt: source.lastFailureAt,

    scraperStats,
  };
}

function calculateRate(
  successfulAttempts: number,
  totalAttempts: number
): number {
  if (totalAttempts === 0) {
    return 0;
  }

  return successfulAttempts / totalAttempts;
}

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}
