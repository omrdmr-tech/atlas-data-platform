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

import type {
  ScraperRegistry,
} from "../../../application/ports/scraper-registry.js";

import type {
  ScraperSelectionPolicy,
} from "../../../application/ports/scraper-selection-policy.js";

import { ScraperRegistry as DefaultScraperRegistry } from "./scraper-registry.js";
import { DefaultScraperSelectionPolicy } from "./default-scraper-selection-policy.js";

export class ScraperOrchestrator
  implements ScraperOrchestratorPort
{
  private readonly registry: ScraperRegistry;
  private readonly selectionPolicy: ScraperSelectionPolicy;

  public constructor(
    scrapers: readonly Scraper[],
    selectionPolicy?: ScraperSelectionPolicy
  );

  public constructor(
    registry: ScraperRegistry,
    selectionPolicy?: ScraperSelectionPolicy
  );

  public constructor(
    scrapersOrRegistry:
      | readonly Scraper[]
      | ScraperRegistry,
    selectionPolicy: ScraperSelectionPolicy =
      new DefaultScraperSelectionPolicy()
  ) {
    if (isScraperArray(scrapersOrRegistry)) {
      if (scrapersOrRegistry.length === 0) {
        throw new Error("At least one scraper is required.");
      }

      const registry = new DefaultScraperRegistry();

      for (const scraper of scrapersOrRegistry) {
        registry.register(scraper);
      }

      this.registry = registry;
    } else {
      this.registry = scrapersOrRegistry;

      if (this.registry.getAll().length === 0) {
        throw new Error("At least one scraper is required.");
      }
    }

    this.selectionPolicy = selectionPolicy;
  }

  public async execute(
    request: ScrapeRequest
  ): Promise<ScraperOrchestrationResult> {
    const failures: ScraperFailure[] = [];

    const candidates = this.registry.findByCapabilities(
      request.requiredCapabilities ?? []
    );

    let remaining = this.selectionPolicy.select(
      request,
      candidates,
      failures
    );

    while (remaining.length > 0) {
      const scraper = remaining[0];

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
          error: new Error(
            `Scraper returned HTTP ${result.statusCode}.`
          ),
        });
      } catch (error) {
        failures.push({
          scraperId: scraper.id,
          reason: classifyError(error),
          statusCode: null,
          error,
        });
      }

      remaining = this.selectionPolicy.select(
        request,
        candidates,
        failures
      );
    }

    throw new ScraperOrchestrationError(
      request.url,
      failures
    );
  }
}

function classifyHttpStatus(
  statusCode: number
): ScraperFailureReason {
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
  if (
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
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

function isScraperArray(
  value: readonly Scraper[] | ScraperRegistry
): value is readonly Scraper[] {
  return Array.isArray(value);
}
