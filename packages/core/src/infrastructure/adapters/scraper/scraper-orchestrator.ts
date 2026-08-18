import type {
  ScraperFailure,
  ScraperOrchestrationResult,
  ScraperOrchestrator as ScraperOrchestratorPort,
} from "../../../application/ports/scraper-orchestrator.js";

import type {
  ScrapeRequest,
  Scraper,
} from "../../../application/ports/scraper.js";

export class ScraperOrchestrator
  implements ScraperOrchestratorPort
{
  private readonly scrapers: readonly Scraper[];

  public constructor(scrapers: readonly Scraper[]) {
    if (scrapers.length === 0) {
      throw new Error("At least one scraper is required.");
    }

    this.scrapers = [...scrapers];
  }

  public async execute(
    request: ScrapeRequest
  ): Promise<ScraperOrchestrationResult> {
    const failures: ScraperFailure[] = [];

    for (const scraper of this.scrapers) {
      try {
        const result = await scraper.execute(request);

        return {
          result,
          scraperId: scraper.id,
          failures: [...failures],
        };
      } catch (error) {
        failures.push({
          scraperId: scraper.id,
          error,
        });
      }
    }

    throw new ScraperOrchestrationError(
      request.url,
      failures
    );
  }
}

export class ScraperOrchestrationError extends Error {
  public readonly url: string;
  public readonly failures: readonly ScraperFailure[];

  public constructor(
    url: string,
    failures: readonly ScraperFailure[]
  ) {
    super(
      `All configured scrapers failed for URL: ${url}`
    );

    this.name = "ScraperOrchestrationError";
    this.url = url;
    this.failures = [...failures];
  }
}
