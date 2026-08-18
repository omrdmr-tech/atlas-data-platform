import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "../../../application/ports/scraper.js";

import type { ScraperDescriptor } from "../../../application/ports/scraper-capabilities.js";

export interface HttpScraperOptions {
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly fetcher?: typeof fetch;
}

export class HttpScraper implements Scraper {
 public readonly id = "http-scraper";

public readonly descriptor = {
  scraperId: "http-scraper",
  capabilities: ["http"] as const,
};

  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly fetcher: typeof fetch;

  public constructor(options: HttpScraperOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.userAgent = options.userAgent ?? "AtlasScraper/0.1";
    this.fetcher = options.fetcher ?? fetch;
  }

  public async execute(request: ScrapeRequest): Promise<ScrapeResult> {
    const url = new URL(request.url);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Only HTTP and HTTPS URLs are supported.");
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetcher(url, {
        method: "GET",
        headers: {
          "User-Agent": this.userAgent,
        },
        redirect: "follow",
        signal: controller.signal,
      });

      return {
        url: response.url,
        statusCode: response.status,
        content: await response.text(),
        contentType: response.headers.get("content-type"),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
