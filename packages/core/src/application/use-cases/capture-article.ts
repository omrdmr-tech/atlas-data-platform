import { ArticleSnapshot } from "../../domain/entities/article-snapshot.js";
import type { Clock } from "../ports/clock.js";
import type { ArticleSnapshotRepository } from "../ports/article-snapshot-repository.js";
import type { ScraperOrchestrator } from "../ports/scraper-orchestrator.js";
import type { UseCase } from "./use-case.js";

export interface CaptureArticleRequest {
  readonly url: string;
}

export class CaptureArticle
  implements UseCase<CaptureArticleRequest, ArticleSnapshot>
{
  public constructor(
    private readonly scraper: ScraperOrchestrator,
    private readonly articles: ArticleSnapshotRepository,
    private readonly clock: Clock
  ) {}

  public async execute(
    request: CaptureArticleRequest
  ): Promise<ArticleSnapshot> {
    const sourceUrl = normalizeSourceUrl(request.url);
    const orchestration = await this.scraper.execute({ url: sourceUrl });

    if (orchestration.result.content.trim().length === 0) {
      throw new Error("The scraper returned an empty article snapshot.");
    }

    const article = new ArticleSnapshot({
      sourceUrl,
      finalUrl: orchestration.result.url,
      html: orchestration.result.content,
      contentType: orchestration.result.contentType,
      fetchedAt: this.clock.now().toISOString(),
      scraperId: orchestration.scraperId,
      ...extractPageLocale(orchestration.result.content),
    });

    await this.articles.save(article);
    return article;
  }
}

function extractPageLocale(html: string): { language: string | null; region: string | null } {
  const language = readHtmlAttribute(html, "lang") ??
    readMetaContent(html, ["og:locale", "content-language", "language", "dc.language"]);
  const region = readMetaContent(html, ["geo.region", "place:location:country", "country"]);
  const localeParts = language?.replaceAll("_", "-").split("-") ?? [];
  const localeRegion = localeParts.find((part) => /^[A-Z]{2}$/.test(part));
  const normalizedLanguage = localeParts[0]?.toLowerCase() ?? null;

  return {
    language: normalizedLanguage,
    region: region?.toUpperCase() ?? localeRegion ?? null,
  };
}

function readHtmlAttribute(html: string, attribute: string): string | null {
  const tag = html.match(/<html\b[^>]*>/i)?.[0];
  const match = tag?.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1]?.trim() || null;
}

function readMetaContent(html: string, names: readonly string[]): string | null {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const name = tag[0].match(/\b(?:name|property|http-equiv)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!name || !names.includes(name.toLowerCase())) continue;
    const content = tag[0].match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    if (content) return content;
  }
  return null;
}

function normalizeSourceUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("A valid absolute article URL is required.");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new Error("Article URLs must use HTTP or HTTPS without credentials.");
  }

  url.hash = "";
  return url.toString();
}
