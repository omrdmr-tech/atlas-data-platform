import type {
  ScraperFailure,
  ScraperFailureReason,
  ScraperOrchestrationResult,
  ScraperOrchestrator as ScraperOrchestratorPort,
} from "../../../application/ports/scraper-orchestrator.js";

import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "../../../application/ports/scraper.js";

import type {
  ScraperRegistry,
} from "../../../application/ports/scraper-registry.js";

import type {
  ScraperSelectionPolicy,
} from "../../../application/ports/scraper-selection-policy.js";

import type {
  ProcessLog,
} from "../../../application/ports/process-log.js";

import type {
  SourceAccessDetector,
  SourceAccessType,
} from "../../../application/ports/source-access-detector.js";

import type {
  SourceAccessLog,
} from "../../../application/ports/source-access-log.js";

import {
  resolveRequestId,
  resolveSourceId,
  isSuccessfulHttpResponse,
} from "../../../application/ports/scrape-execution.js";

import type {
  RequestIdGenerator,
} from "../../../application/ports/scrape-execution.js";

import {
  ScraperRegistry as DefaultScraperRegistry,
} from "./scraper-registry.js";

import {
  DefaultScraperSelectionPolicy,
} from "./default-scraper-selection-policy.js";

import {
  ContentAccessDetector,
} from "./content-access-detector.js";

import {
  SystemRequestIdGenerator,
} from "../logging/system-request-id-generator.js";

export interface ScraperOrchestratorOptions {
  readonly processLog?: ProcessLog;
  readonly sourceAccessLog?: SourceAccessLog;
  readonly accessDetector?: SourceAccessDetector;
  readonly requestIdGenerator?: RequestIdGenerator;
  readonly now?: () => Date;
  readonly maxAttempts?: number;
}

export class ScraperOrchestrator
  implements ScraperOrchestratorPort
{
  private readonly registry: ScraperRegistry;
  private readonly selectionPolicy: ScraperSelectionPolicy;
  private readonly processLog?: ProcessLog;
  private readonly sourceAccessLog?: SourceAccessLog;
  private readonly accessDetector: SourceAccessDetector;
  private readonly requestIdGenerator: RequestIdGenerator;
  private readonly now: () => Date;
  private readonly maxAttempts: number;

  public constructor(
    scrapers: readonly Scraper[],
    selectionPolicy?: ScraperSelectionPolicy,
    options?: ScraperOrchestratorOptions
  );

  public constructor(
    registry: ScraperRegistry,
    selectionPolicy?: ScraperSelectionPolicy,
    options?: ScraperOrchestratorOptions
  );

  public constructor(
    scrapersOrRegistry:
      | readonly Scraper[]
      | ScraperRegistry,
    selectionPolicy: ScraperSelectionPolicy =
      new DefaultScraperSelectionPolicy(),
    options: ScraperOrchestratorOptions = {}
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
    this.processLog = options.processLog;
    this.sourceAccessLog = options.sourceAccessLog;
    this.accessDetector =
      options.accessDetector ??
      new ContentAccessDetector();
    this.requestIdGenerator =
      options.requestIdGenerator ??
      new SystemRequestIdGenerator();
    this.now = options.now ?? (() => new Date());
    this.maxAttempts = options.maxAttempts ?? 3;

    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts <= 0) {
      throw new Error('maxAttempts must be a positive integer.');
    }
  }

  public async execute(
    request: ScrapeRequest
  ): Promise<ScraperOrchestrationResult> {
    const failures: ScraperFailure[] = [];

    const requestId = resolveRequestId(
      request,
      this.requestIdGenerator
    );

    const sourceId = resolveSourceId(request);

    const candidates = this.registry.findByCapabilities(
      request.requiredCapabilities ?? []
    );

    let remaining = await this.selectionPolicy.select(
      request,
      candidates,
      failures
    );

    let attempt = 0;

    while (
      remaining.length > 0 &&
      attempt < this.maxAttempts
    ) {
      const scraper = remaining[0];
      attempt++;

      const startedAt = this.now();

      try {
        const result = await scraper.execute(request);

        const accessType = resolveAccessType(scraper);

        const access = this.accessDetector.detect(
          result,
          accessType
        );

        await this.sourceAccessLog?.append({
          requestId,
          sourceId,
          url: request.url,
          domain: new URL(request.url).hostname.toLowerCase(),
          accessStatus: access.status,
          accessType: access.accessType,
          detectedAt: this.now().toISOString(),
          scraperId: scraper.id,
          httpStatus: result.statusCode,
          requiresLogin: access.requiresLogin,
          requiresSubscription:
            access.requiresSubscription,
          paywallDetected: access.paywallDetected,
          captchaDetected: access.captchaDetected,
          contentAvailable:
            access.contentAvailable,
        });

        if (
          isSuccessfulHttpResponse(result) &&
          access.contentAvailable
        ) {
          await this.writeProcessLog({
            requestId,
            sourceId,
            url: request.url,
            startedAt,
            scraperId: scraper.id,
            attempt,
            status: "success",
            fallbackUsed: attempt > 1,
          });

          return {
            result,
            scraperId: scraper.id,
            failures: [...failures],
          };
        }

        const reason =
          isSuccessfulHttpResponse(result)
            ? "blocked"
            : classifyHttpStatus(result.statusCode);

        const error = new Error(
          isSuccessfulHttpResponse(result)
            ? `Source access status: ${access.status}.`
            : `Scraper returned HTTP ${result.statusCode}.`
        );

        failures.push({
          scraperId: scraper.id,
          reason,
          statusCode: result.statusCode,
          error,
        });

        await this.writeProcessLog({
          requestId,
          sourceId,
          url: request.url,
          startedAt,
          scraperId: scraper.id,
          attempt,
          status: "failed",
          failureReason: reason,
          fallbackUsed: attempt > 1,
          error: error.message,
        });
      } catch (error) {
        const reason = classifyError(error);

        await this.sourceAccessLog?.append({
          requestId,
          sourceId,
          url: request.url,
          domain: new URL(request.url).hostname.toLowerCase(),
          accessStatus: mapFailureToAccessStatus(reason),
          accessType: resolveAccessType(scraper),
          detectedAt: this.now().toISOString(),
          scraperId: scraper.id,
          httpStatus: null,
          requiresLogin: false,
          requiresSubscription: false,
          paywallDetected: false,
          captchaDetected: false,
          contentAvailable: false,
        });

        failures.push({
          scraperId: scraper.id,
          reason,
          statusCode: null,
          error,
        });

        await this.writeProcessLog({
          requestId,
          sourceId,
          url: request.url,
          startedAt,
          scraperId: scraper.id,
          attempt,
          status: "failed",
          failureReason: reason,
          fallbackUsed: attempt > 1,
          error: stringifyError(error),
        });
      }

      remaining = await this.selectionPolicy.select(
        request,
        candidates,
        failures
      );
    }

    throw new ScraperOrchestrationError(
      request.url,
      failures,
      attempt,
      this.maxAttempts
    );
  }

  private async writeProcessLog(
    input: {
      readonly requestId: string;
      readonly sourceId: string;
      readonly url: string;
      readonly startedAt: Date;
      readonly scraperId: string;
      readonly attempt: number;
      readonly status: "success" | "failed";
      readonly failureReason?: ScraperFailureReason;
      readonly fallbackUsed: boolean;
      readonly error?: string;
    }
  ): Promise<void> {
    if (!this.processLog) {
      return;
    }

    const completedAt = this.now();

    await this.processLog.append({
      requestId: input.requestId,
      sourceId: input.sourceId,
      url: input.url,
      startedAt: input.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      scraperId: input.scraperId,
      attempt: input.attempt,
      durationMs:
        completedAt.getTime() -
        input.startedAt.getTime(),
      status: input.status,
      failureReason: input.failureReason,
      fallbackUsed: input.fallbackUsed,
      error: input.error,
    });
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

function classifyError(
  error: unknown
): ScraperFailureReason {
  if (
    typeof DOMException !== "undefined" &&
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

function mapFailureToAccessStatus(
  reason: ScraperFailureReason
) {
  switch (reason) {
    case "rate-limited":
      return "rate-limited" as const;

    case "timeout":
    case "network-error":
      return "network-unavailable" as const;

    case "server-error":
      return "server-error" as const;

    case "blocked":
      return "bot-blocked" as const;

    default:
      return "unknown" as const;
  }
}

function resolveAccessType(
  scraper: Scraper
): SourceAccessType {
  const capabilities = scraper.descriptor.capabilities;

  if (capabilities.includes("proxy")) {
    return "proxy";
  }

  if (capabilities.includes("browser")) {
    return "browser";
  }

  if (capabilities.includes("http")) {
    return "http";
  }

  return "unknown";
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export class ScraperOrchestrationError extends Error {
  public readonly url: string;
  public readonly failures: readonly ScraperFailure[];
  public readonly attempts: number;
  public readonly maxAttempts: number;
  public readonly budgetExhausted: boolean;

  public constructor(
    url: string,
    failures: readonly ScraperFailure[],
    attempts: number,
    maxAttempts: number
  ) {
    super(
      `All configured scrapers failed for URL: ${url}`
    );

    this.name = "ScraperOrchestrationError";
    this.url = url;
    this.failures = [...failures];
    this.attempts = attempts;
    this.maxAttempts = maxAttempts;
    this.budgetExhausted = attempts >= maxAttempts;
  }
}

function isScraperArray(
  value: readonly Scraper[] | ScraperRegistry
): value is readonly Scraper[] {
  return Array.isArray(value);
}
