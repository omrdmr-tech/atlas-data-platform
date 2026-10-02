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
    });

    await this.articles.save(article);
    return article;
  }
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
