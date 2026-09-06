import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "../../../application/ports/scraper.js";

export interface BrowserPage {
  goto(
    url: string,
    options?: {
      readonly waitUntil?: "load" | "domcontentloaded" | "networkidle";
      readonly timeout?: number;
    }
  ): Promise<{
    url(): string;
    status(): number | null;
  } | null>;

  content(): Promise<string>;

  evaluate<T>(pageFunction: () => T): Promise<T>;

  close(): Promise<void>;
}

export interface BrowserContext {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
}

export interface BrowserInstance {
  newContext(options?: {
    readonly userAgent?: string;
  }): Promise<BrowserContext>;

  close(): Promise<void>;
}

export interface BrowserFactory {
  launch(options?: {
    readonly headless?: boolean;
  }): Promise<BrowserInstance>;
}

export interface BrowserScraperOptions {
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly headless?: boolean;
  readonly waitUntil?:
    | "load"
    | "domcontentloaded"
    | "networkidle";
  readonly browserFactory?: BrowserFactory;
}

export class BrowserScraper implements Scraper {
  public readonly id = "browser-scraper";

  public readonly descriptor = {
    scraperId: "browser-scraper",
    capabilities: ["browser", "javascript"] as const,
  };

  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly headless: boolean;
  private readonly waitUntil:
    | "load"
    | "domcontentloaded"
    | "networkidle";
  private readonly browserFactory: BrowserFactory;

  public constructor(options: BrowserScraperOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.userAgent =
      options.userAgent ?? "AtlasBrowserScraper/0.1";
    this.headless = options.headless ?? true;
    this.waitUntil = options.waitUntil ?? "domcontentloaded";

    this.browserFactory =
      options.browserFactory ?? createPlaywrightBrowserFactory();
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

    const browser = await this.browserFactory.launch({
      headless: this.headless,
    });

    let context: BrowserContext | null = null;
    let page: BrowserPage | null = null;

    try {
      context = await browser.newContext({
        userAgent: this.userAgent,
      });

      page = await context.newPage();

      const response = await page.goto(request.url, {
        waitUntil: this.waitUntil,
        timeout: this.timeoutMs,
      });

      return {
        url: response?.url() ?? request.url,
        statusCode: response?.status() ?? 200,
        content: await page.content(),
        contentType: "text/html",
      };
    } finally {
      if (page) {
        await page.close();
      }

      if (context) {
        await context.close();
      }

      await browser.close();
    }
  }
}

function createPlaywrightBrowserFactory(): BrowserFactory {
  return {
    async launch(options = {}) {
      const { chromium } = await import("playwright");

      const browser = await chromium.launch({
        headless: options.headless ?? true,
      });

      return {
        async newContext(contextOptions = {}) {
          const context = await browser.newContext({
            userAgent: contextOptions.userAgent,
          });

          return {
            async newPage() {
              const page = await context.newPage();

              return {
                async goto(url, gotoOptions = {}) {
                  const response = await page.goto(url, {
                    waitUntil:
                      gotoOptions.waitUntil ?? "domcontentloaded",
                    timeout: gotoOptions.timeout,
                  });

                  if (!response) {
                    return null;
                  }

                  return {
                    url: () => response.url(),
                    status: () => response.status(),
                  };
                },

                async content() {
                  return page.content();
                },

                async evaluate<T>(
                  pageFunction: () => T
                ): Promise<T> {
                  return page.evaluate(pageFunction);
                },

                async close() {
                  await page.close();
                },
              };
            },

            async close() {
              await context.close();
            },
          };
        },

        async close() {
          await browser.close();
        },
      };
    },
  };
}

