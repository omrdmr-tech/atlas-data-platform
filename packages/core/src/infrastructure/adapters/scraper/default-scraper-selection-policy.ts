import type { ScraperSelectionPolicy } from "./scraper-selection-policy.js";
import type { ScraperFailure } from "./scraper-orchestrator.js";
import type { ScrapeRequest, Scraper } from "./scraper.js";

export class DefaultScraperSelectionPolicy
  implements ScraperSelectionPolicy
{
  public select(
    request: ScrapeRequest,
    candidates: readonly Scraper[],
    failures: readonly ScraperFailure[]
  ): readonly Scraper[] {
    const failedIds = new Set(
      failures.map((failure) => failure.scraperId)
    );

    const available = candidates.filter(
      (scraper) => !failedIds.has(scraper.id)
    );

    if (available.length <= 1 || failures.length === 0) {
      return [...available];
    }

    const latestFailure = failures[failures.length - 1];

    return available
      .map((scraper, index) => ({
        scraper,
        index,
        score: scoreScraper(scraper, latestFailure, request),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.index - right.index;
      })
      .map((entry) => entry.scraper);
  }
}

function scoreScraper(
  scraper: Scraper,
  failure: ScraperFailure,
  request: ScrapeRequest
): number {
  const capabilities = scraper.descriptor.capabilities;

  let score = 0;

  switch (failure.reason) {
    case "blocked":
      if (capabilities.includes("anti-bot")) {
        score += 100;
      }

      if (capabilities.includes("browser")) {
        score += 50;
      }
      break;

    case "rate-limited":
      if (capabilities.includes("proxy")) {
        score += 100;
      }

      if (capabilities.includes("browser")) {
        score += 20;
      }
      break;

    case "timeout":
      if (capabilities.includes("browser")) {
        score += 50;
      }

      if (capabilities.includes("proxy")) {
        score += 20;
      }
      break;

    case "network-error":
      if (capabilities.includes("proxy")) {
        score += 50;
      }

      if (capabilities.includes("browser")) {
        score += 20;
      }
      break;

    case "server-error":
      if (capabilities.includes("browser")) {
        score += 20;
      }

      if (capabilities.includes("proxy")) {
        score += 10;
      }
      break;

    case "http-error":
    case "unknown":
      if (capabilities.includes("browser")) {
        score += 10;
      }
      break;
  }

  if (request.requiredCapabilities) {
    for (const capability of request.requiredCapabilities) {
      if (capabilities.includes(capability)) {
        score += 5;
      }
    }
  }

  return score;
}
