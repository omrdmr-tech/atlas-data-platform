import type { Clock } from "../ports/clock.js";
import type {
  SourceReliabilityScore,
  SourceReliabilityScorer,
} from "../ports/source-reliability-scorer.js";
import type {
  SourceHealthSnapshot,
  SourceScraperHealth,
} from "../ports/source-health.js";

export interface SourceReliabilityScorerOptions {
  readonly halfLifeMs?: number;
  readonly confidenceAttempts?: number;
  readonly neutralScore?: number;
}

const DEFAULT_HALF_LIFE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CONFIDENCE_ATTEMPTS = 5;
const DEFAULT_NEUTRAL_SCORE = 0.5;

export class DefaultSourceReliabilityScorer
  implements SourceReliabilityScorer
{
  private readonly halfLifeMs: number;
  private readonly confidenceAttempts: number;
  private readonly neutralScore: number;

  public constructor(
    private readonly clock: Clock,
    options: SourceReliabilityScorerOptions = {},
  ) {
    this.halfLifeMs =
      options.halfLifeMs ?? DEFAULT_HALF_LIFE_MS;

    this.confidenceAttempts =
      options.confidenceAttempts ??
      DEFAULT_CONFIDENCE_ATTEMPTS;

    this.neutralScore =
      options.neutralScore ??
      DEFAULT_NEUTRAL_SCORE;

    if (
      !Number.isFinite(this.halfLifeMs) ||
      this.halfLifeMs <= 0
    ) {
      throw new Error(
        "Reliability half-life must be greater than zero.",
      );
    }

    if (
      !Number.isFinite(this.confidenceAttempts) ||
      this.confidenceAttempts <= 0
    ) {
      throw new Error(
        "Reliability confidence attempts must be greater than zero.",
      );
    }

    if (
      !Number.isFinite(this.neutralScore) ||
      this.neutralScore < 0 ||
      this.neutralScore > 1
    ) {
      throw new Error(
        "Reliability neutral score must be between 0 and 1.",
      );
    }
  }

  public score(
    source: SourceHealthSnapshot,
    scraper: SourceScraperHealth,
  ): SourceReliabilityScore {
    const successRate = clamp(
      scraper.successRate,
      0,
      1,
    );

    const effectiveAttempts =
      scraper.totalAttempts;

    const historyConfidence =
      calculateHistoryConfidence(
        effectiveAttempts,
        this.confidenceAttempts,
      );

    const recencyWeight =
      calculateRecencyWeight(
        scraper.lastAttemptAt,
        this.clock.now(),
        this.halfLifeMs,
      );

    /*
     * The raw historical rate is progressively pulled toward
     * the neutral score as it becomes stale.
     *
     * This intentionally does not mutate or discard historical
     * counters. Reliability is a derived read-time value.
     */
    const influence =
      historyConfidence * recencyWeight;

    const score =
      this.neutralScore +
      (successRate - this.neutralScore) * influence;

    return {
      sourceId: source.sourceId,
      scraperId: scraper.scraperId,
      score: clamp(score, 0, 1),
      successRate,
      historyConfidence,
      recencyWeight,
      effectiveAttempts,
      lastAttemptAt: scraper.lastAttemptAt,
    };
  }
}

function calculateHistoryConfidence(
  attempts: number,
  confidenceAttempts: number,
): number {
  if (attempts <= 0) {
    return 0;
  }

  return clamp(
    attempts / confidenceAttempts,
    0,
    1,
  );
}

function calculateRecencyWeight(
  lastAttemptAt: string | null,
  now: Date,
  halfLifeMs: number,
): number {
  if (!lastAttemptAt) {
    return 0;
  }

  const lastAttempt = new Date(lastAttemptAt);

  if (Number.isNaN(lastAttempt.getTime())) {
    return 0;
  }

  const ageMs = Math.max(
    0,
    now.getTime() - lastAttempt.getTime(),
  );

  /*
   * Every half-life reduces the historical influence by half.
   */
  return Math.pow(
    0.5,
    ageMs / halfLifeMs,
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}