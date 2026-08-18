import type {
  ScraperFailure,
  ScraperFailureReason,
  ScraperOrchestrationResult,
  ScraperOrchestrator as ScraperOrchestratorPort,
} from "../../../application/ports/scraper-orchestrator.js";

import type {
  ScrapeRequest,
  Scraper,
} from "../../../application/ports/scraper.js";
import type { ScraperCapability } from "../../../application/ports/scraper-capabilities.js";

export class ScraperOrchestrator implements ScraperOrchestratorPort {
  private readonly scrapers: readonly Scraper[];

  public constructor(scrapers: readonly Scraper[]) {
    if (scrapers.length === 0) {
      throw new Error("At least one scraper is required.");
    }

    this.scrapers = [...scrapers];
  }

  public async execute(
    request: ScrapeRequest,
  ): Promise<ScraperOrchestrationResult> {
    const failures: ScraperFailure[] = [];

    for (const scraper of this.scrapers) {
      if (
        !supportsRequiredCapabilities(scraper, request.requiredCapabilities)
      ) {
        continue;
      }

      try {
        const result = await scraper.execute(request);

        if (result.statusCode >= 200 && result.statusCode < 300) {
          return {
            result,
            scraperId: scraper.id,
            failures: [...failures],
          };
        }

        failures.push({
          scraperId: scraper.id,
          reason: classifyHttpStatus(result.statusCode),
          statusCode: result.statusCode,
          error: new Error(`Scraper returned HTTP ${result.statusCode}.`),
        });
      } catch (error) {
        failures.push({
          scraperId: scraper.id,
          reason: classifyError(error),
          statusCode: null,
          error,
        });
      }
    }

    throw new ScraperOrchestrationError(request.url, failures);
  }
}
function supportsRequiredCapabilities(
  scraper: Scraper,
  requiredCapabilities:
    | readonly ScraperCapability[]
    | undefined
): boolean {
  if (
    requiredCapabilities === undefined ||
    requiredCapabilities.length === 0
  ) {
    return true;
  }

  return requiredCapabilities.every(
    (requiredCapability) =>
      scraper.descriptor.capabilities.includes(
        requiredCapability
      )
  );
}
function classifyHttpStatus(statusCode: number): ScraperFailureReason {
  if (statusCode === 401 || statusCode === 403) {
    return "blocked";
  }

  if (statusCode === 408 || statusCode === 504) {
    return "timeout";
  }

  if (statusCode === 429) {
    return "rate-limited";
  }

  if (statusCode >= 500 && statusCode <= 599) {
    return "server-error";
  }

  if (statusCode >= 400 && statusCode <= 499) {
    return "http-error";
  }

  return "unknown";
}

function classifyError(error: unknown): ScraperFailureReason {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "timeout";
  }

  if (error instanceof TypeError) {
    return "network-error";
  }

  return "unknown";
}

export class ScraperOrchestrationError extends Error {
  public readonly url: string;
  public readonly failures: readonly ScraperFailure[];

  public constructor(url: string, failures: readonly ScraperFailure[]) {
    super(`All configured scrapers failed for URL: ${url}`);

    this.name = "ScraperOrchestrationError";
    this.url = url;
    this.failures = [...failures];
  }
}
