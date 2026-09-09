import type {
  ScrapeRequest,
  Scraper,
} from "../../../application/ports/scraper.js";

import type {
  ScraperFailure,
} from "../../../application/ports/scraper-orchestrator.js";

import type {
  ScraperSelectionPolicy,
} from "../../../application/ports/scraper-selection-policy.js";

import type {
  SourceHealthSnapshot,
  SourceHealthStore,
} from "../../../application/ports/source-health.js";

import type {
  SourceReliabilityScorer,
} from "../../../application/ports/source-reliability-scorer.js";

import {
  SystemClock,
} from "../system-clock.js";

import {
  DefaultSourceReliabilityScorer,
} from "../../../application/services/source-reliability-scorer.js";

import {
  DefaultScraperSelectionPolicy,
} from "./default-scraper-selection-policy.js";

export interface AdaptiveScraperSelectionPolicyOptions {
  readonly minimumAttempts?: number;
  readonly successWeight?: number;
  readonly failureWeight?: number;
  readonly reliabilityScorer?: SourceReliabilityScorer;
}

export class AdaptiveScraperSelectionPolicy
  implements ScraperSelectionPolicy
{
  private readonly basePolicy: ScraperSelectionPolicy;
  private readonly minimumAttempts: number;
  private readonly successWeight: number;
  private readonly failureWeight: number;
  private readonly reliabilityScorer: SourceReliabilityScorer;

  public constructor(
    private readonly healthStore: SourceHealthStore,
    basePolicy: ScraperSelectionPolicy =
      new DefaultScraperSelectionPolicy(),
    options: AdaptiveScraperSelectionPolicyOptions = {},
  ) {
    this.basePolicy = basePolicy;
    this.minimumAttempts =
      options.minimumAttempts ?? 2;
    this.successWeight =
      options.successWeight ?? 100;
    this.failureWeight =
      options.failureWeight ?? 100;

    this.reliabilityScorer =
      options.reliabilityScorer ??
      new DefaultSourceReliabilityScorer(
        new SystemClock(),
      );
  }

  public async select(
    request: ScrapeRequest,
    candidates: readonly Scraper[],
    failures: readonly ScraperFailure[],
  ): Promise<readonly Scraper[]> {
    const baseline =
      await this.basePolicy.select(
        request,
        candidates,
        failures,
      );

    if (baseline.length <= 1) {
      return baseline;
    }

    const sourceId =
      resolveSourceId(request);

    const health =
      await this.healthStore.get(sourceId);

    if (!health) {
      return baseline;
    }

    const baselineIndexes = new Map(
      baseline.map((scraper, index) => [
        scraper.id,
        index,
      ]),
    );

    return [...baseline].sort(
      (left, right) => {
        const leftScore =
          this.healthScore(left, health);

        const rightScore =
          this.healthScore(right, health);

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        return (
          (baselineIndexes.get(left.id) ?? 0) -
          (baselineIndexes.get(right.id) ?? 0)
        );
      },
    );
  }

  private healthScore(
    scraper: Scraper,
    health: SourceHealthSnapshot,
  ): number {
    const stats =
      health.scraperStats.find(
        (item) =>
          item.scraperId === scraper.id,
      );

    if (
      !stats ||
      stats.totalAttempts <
        this.minimumAttempts
    ) {
      return 0;
    }

    const reliability =
      this.reliabilityScorer.score(
        health,
        stats,
      );

    return (
      reliability.score *
        this.successWeight -
      (1 - reliability.score) *
        this.failureWeight
    );
  }
}

function resolveSourceId(
  request: ScrapeRequest,
): string {
  if (request.sourceId) {
    return request.sourceId;
  }

  return new URL(
    request.url,
  ).hostname.toLowerCase();
}