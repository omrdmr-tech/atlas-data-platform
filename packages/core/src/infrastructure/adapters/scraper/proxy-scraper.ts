import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "../../../application/ports/scraper.js";

import type {
  ProxyFailureReason,
  ProxyProvider,
} from "../../../application/ports/proxy-provider.js";

import type {
  ProxyTransport,
  ProxyTransportResponse,
} from "../../../application/ports/proxy-transport.js";

export interface ProxyScraperOptions {
  readonly userAgent?: string;
  readonly maxAttempts?: number;
}

export class ProxyScraper implements Scraper {
  public readonly id = "proxy-scraper";

  public readonly descriptor = {
    scraperId: "proxy-scraper",
    capabilities: ["http", "proxy"] as const,
  };

  private readonly userAgent: string;
  private readonly maxAttempts: number;

  public constructor(
    private readonly proxyProvider: ProxyProvider,
    private readonly proxyTransport: ProxyTransport,
    options: ProxyScraperOptions = {}
  ) {
    this.userAgent =
      options.userAgent ??
      "AtlasProxyScraper/0.1";

    this.maxAttempts =
      options.maxAttempts ?? 3;

    if (
      !Number.isInteger(this.maxAttempts) ||
      this.maxAttempts < 1
    ) {
      throw new Error(
        "Maximum proxy attempts must be a positive integer."
      );
    }
  }

  public async execute(
    request: ScrapeRequest
  ): Promise<ScrapeResult> {
    const url = new URL(request.url);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      throw new Error(
        "Only HTTP and HTTPS URLs are supported."
      );
    }

    let lastError: unknown = null;
    let lastResponse: ProxyTransportResponse | null = null;

    for (
      let attempt = 0;
      attempt < this.maxAttempts;
      attempt++
    ) {
      const proxy =
        await this.proxyProvider.acquire();

      if (!proxy) {
        break;
      }

      try {
        const response =
          await this.proxyTransport.execute({
            url: request.url,
            proxy,
            init: {
              method: "GET",
              headers: {
                "User-Agent": this.userAgent,
              },
            },
          });

        lastResponse = response;

        if (
          response.statusCode >= 200 &&
          response.statusCode < 300
        ) {
          await this.proxyProvider.reportSuccess(
            proxy.id
          );

          return {
            url: response.url,
            statusCode: response.statusCode,
            content: response.content,
            contentType: response.contentType,
          };
        }

        const reason =
          classifyHttpStatus(
            response.statusCode
          );

        await this.proxyProvider.reportFailure(
          proxy.id,
          reason
        );

        if (
          !shouldRetry(reason) ||
          attempt === this.maxAttempts - 1
        ) {
          return {
            url: response.url,
            statusCode: response.statusCode,
            content: response.content,
            contentType: response.contentType,
          };
        }
      } catch (error) {
        lastError = error;

        const reason =
          classifyError(error);

        await this.proxyProvider.reportFailure(
          proxy.id,
          reason
        );

        if (
          !shouldRetry(reason) ||
          attempt === this.maxAttempts - 1
        ) {
          throw error;
        }
      }
    }

    if (lastResponse) {
      return {
        url: lastResponse.url,
        statusCode: lastResponse.statusCode,
        content: lastResponse.content,
        contentType: lastResponse.contentType,
      };
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error(
      "No available proxy is configured."
    );
  }
}

function shouldRetry(
  reason: ProxyFailureReason
): boolean {
  return (
    reason === "blocked" ||
    reason === "rate-limited" ||
    reason === "server-error" ||
    reason === "timeout" ||
    reason === "network-error"
  );
}

function classifyHttpStatus(
  statusCode: number
): ProxyFailureReason {
  if (
    statusCode === 401 ||
    statusCode === 403
  ) {
    return "blocked";
  }

  if (
    statusCode === 408 ||
    statusCode === 504
  ) {
    return "timeout";
  }

  if (statusCode === 429) {
    return "rate-limited";
  }

  if (
    statusCode >= 500 &&
    statusCode <= 599
  ) {
    return "server-error";
  }

  if (
    statusCode >= 400 &&
    statusCode <= 499
  ) {
    return "http-error";
  }

  return "unknown";
}

function classifyError(
  error: unknown
): ProxyFailureReason {
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
