import assert from "node:assert/strict";
import test from "node:test";

import type { Clock } from "../ports/clock.js";
import type {
  SourceHealthSnapshot,
  SourceScraperHealth,
} from "../ports/source-health.js";

import {
  DefaultSourceReliabilityScorer,
} from "./source-reliability-scorer.js";

class FakeClock implements Clock {
  public constructor(
    private readonly current: Date,
  ) {}

  public now(): Date {
    return new Date(this.current);
  }
}

function source(): SourceHealthSnapshot {
  return {
    sourceId: "source-1",
    domain: "example.com",
    totalAttempts: 10,
    successfulAttempts: 8,
    failedAttempts: 2,
    loginRequiredCount: 0,
    subscriptionRequiredCount: 0,
    paywallCount: 0,
    captchaCount: 0,
    botBlockedCount: 2,
    rateLimitedCount: 0,
    networkUnavailableCount: 0,
    serverErrorCount: 0,
    partialContentCount: 0,
    lastAccessStatus: "accessible",
    lastAccessType: "http",
    lastScraperId: "http",
    lastAttemptAt: "2026-09-08T10:00:00.000Z",
    lastSuccessAt: "2026-09-08T10:00:00.000Z",
    lastFailureAt: "2026-09-08T09:00:00.000Z",
    scraperStats: [],
  };
}

function scraper(
  overrides: Partial<SourceScraperHealth> = {},
): SourceScraperHealth {
  return {
    scraperId: "http",
    accessType: "http",
    totalAttempts: 10,
    successfulAttempts: 8,
    failedAttempts: 2,
    successRate: 0.8,
    lastAccessStatus: "accessible",
    lastAttemptAt: "2026-09-08T10:00:00.000Z",
    lastSuccessAt: "2026-09-08T10:00:00.000Z",
    lastFailureAt: "2026-09-08T09:00:00.000Z",
    ...overrides,
  };
}

test("reliability score is strong for recent successful history", () => {
  const scorer =
    new DefaultSourceReliabilityScorer(
      new FakeClock(
        new Date("2026-09-08T10:00:00.000Z"),
      ),
      {
        halfLifeMs: 24 * 60 * 60 * 1000,
        confidenceAttempts: 5,
      },
    );

  const result = scorer.score(
    source(),
    scraper(),
  );

  assert.equal(result.successRate, 0.8);
  assert.equal(result.historyConfidence, 1);
  assert.equal(result.recencyWeight, 1);
  assert.equal(result.score, 0.8);
});

test("insufficient history keeps reliability close to neutral", () => {
  const scorer =
    new DefaultSourceReliabilityScorer(
      new FakeClock(
        new Date("2026-09-08T10:00:00.000Z"),
      ),
      {
        halfLifeMs: 24 * 60 * 60 * 1000,
        confidenceAttempts: 5,
      },
    );

  const result = scorer.score(
    source(),
    scraper({
      totalAttempts: 1,
      successfulAttempts: 1,
      failedAttempts: 0,
      successRate: 1,
    }),
  );

  assert.equal(result.historyConfidence, 0.2);
  assert.equal(result.score, 0.6);
});

test("reliability decays toward neutral after one half-life", () => {
  const scorer =
    new DefaultSourceReliabilityScorer(
      new FakeClock(
        new Date("2026-09-09T10:00:00.000Z"),
      ),
      {
        halfLifeMs: 24 * 60 * 60 * 1000,
        confidenceAttempts: 5,
      },
    );

  const result = scorer.score(
    source(),
    scraper(),
  );

  assert.equal(result.recencyWeight, 0.5);
  assert.equal(result.score, 0.65);
});

test("reliability decays further after multiple half-lives", () => {
  const scorer =
    new DefaultSourceReliabilityScorer(
      new FakeClock(
        new Date("2026-09-11T10:00:00.000Z"),
      ),
      {
        halfLifeMs: 24 * 60 * 60 * 1000,
        confidenceAttempts: 5,
      },
    );

  const result = scorer.score(
    source(),
    scraper(),
  );

  assert.equal(result.recencyWeight, 0.125);
  assert.equal(result.score, 0.5375);
});

test("old failed history moves back toward neutral", () => {
  const scorer =
    new DefaultSourceReliabilityScorer(
      new FakeClock(
        new Date("2026-09-09T10:00:00.000Z"),
      ),
      {
        halfLifeMs: 24 * 60 * 60 * 1000,
        confidenceAttempts: 5,
      },
    );

  const result = scorer.score(
    source(),
    scraper({
      totalAttempts: 10,
      successfulAttempts: 0,
      failedAttempts: 10,
      successRate: 0,
    }),
  );

  assert.equal(result.recencyWeight, 0.5);
  assert.equal(result.score, 0.25);
});

test("missing last attempt has no historical influence", () => {
  const scorer =
    new DefaultSourceReliabilityScorer(
      new FakeClock(
        new Date("2026-09-08T10:00:00.000Z"),
      ),
    );

  const result = scorer.score(
    source(),
    scraper({
      lastAttemptAt: null,
    }),
  );

  assert.equal(result.recencyWeight, 0);
  assert.equal(result.score, 0.5);
});

test("invalid last attempt has no historical influence", () => {
  const scorer =
    new DefaultSourceReliabilityScorer(
      new FakeClock(
        new Date("2026-09-08T10:00:00.000Z"),
      ),
    );

  const result = scorer.score(
    source(),
    scraper({
      lastAttemptAt: "not-a-date",
    }),
  );

  assert.equal(result.recencyWeight, 0);
  assert.equal(result.score, 0.5);
});

test("future timestamps are treated as current", () => {
  const scorer =
    new DefaultSourceReliabilityScorer(
      new FakeClock(
        new Date("2026-09-08T09:00:00.000Z"),
      ),
    );

  const result = scorer.score(
    source(),
    scraper({
      lastAttemptAt: "2026-09-08T10:00:00.000Z",
    }),
  );

  assert.equal(result.recencyWeight, 1);
});

test("scorer validates half-life", () => {
  assert.throws(
    () =>
      new DefaultSourceReliabilityScorer(
        new FakeClock(new Date()),
        {
          halfLifeMs: 0,
        },
      ),
    /half-life must be greater than zero/i,
  );
});

test("scorer validates confidence attempts", () => {
  assert.throws(
    () =>
      new DefaultSourceReliabilityScorer(
        new FakeClock(new Date()),
        {
          confidenceAttempts: 0,
        },
      ),
    /confidence attempts must be greater than zero/i,
  );
});

test("scorer validates neutral score", () => {
  assert.throws(
    () =>
      new DefaultSourceReliabilityScorer(
        new FakeClock(new Date()),
        {
          neutralScore: 2,
        },
      ),
    /neutral score must be between 0 and 1/i,
  );
});