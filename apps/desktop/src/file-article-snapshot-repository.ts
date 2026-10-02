import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  ArticleSnapshot,
  ArticleSnapshotRepository,
} from "@atlas/core";
import { ArticleSnapshot as ArticleSnapshotEntity } from "@atlas/core";

interface StoredArticleSnapshot {
  readonly sourceUrl: string;
  readonly finalUrl: string;
  readonly html: string;
  readonly contentType: string | null;
  readonly fetchedAt: string;
  readonly scraperId: string;
}

export class FileArticleSnapshotRepository
  implements ArticleSnapshotRepository
{
  private writeQueue: Promise<void> = Promise.resolve();

  public constructor(private readonly filePath: string) {}

  public async findById(sourceUrl: string): Promise<ArticleSnapshot | null> {
    await this.writeQueue;
    const normalizedUrl = normalizeSourceUrl(sourceUrl);
    const articles = await this.readAll();
    const article = articles.find((entry) => entry.sourceUrl === normalizedUrl);

    return article ? toEntity(article) : null;
  }

  public async findRecent(limit = 50): Promise<readonly ArticleSnapshot[]> {
    if (!Number.isInteger(limit) || limit <= 0 || limit > 500) {
      throw new Error("limit must be an integer between 1 and 500.");
    }

    await this.writeQueue;
    const articles = await this.readAll();

    return articles
      .sort((left, right) => Date.parse(right.fetchedAt) - Date.parse(left.fetchedAt))
      .slice(0, limit)
      .map(toEntity);
  }

  public async save(article: ArticleSnapshot): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const articles = await this.readAll();
      const stored = toRecord(article);
      const existingIndex = articles.findIndex(
        (entry) => entry.sourceUrl === stored.sourceUrl
      );

      if (existingIndex >= 0) {
        articles[existingIndex] = stored;
      } else {
        articles.push(stored);
      }

      await mkdir(dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(articles), "utf8");
      await rename(temporaryPath, this.filePath);
    });

    this.writeQueue = operation.catch(() => undefined);
    await operation;
  }

  private async readAll(): Promise<StoredArticleSnapshot[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(contents);

      if (!Array.isArray(parsed)) {
        throw new Error("The article archive file has an invalid format.");
      }

      return parsed.map((entry: unknown) => {
        if (!isStoredArticle(entry)) {
          throw new Error("The article archive contains an invalid record.");
        }

        return entry;
      });
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }

      throw error;
    }
  }
}

function toRecord(article: ArticleSnapshot): StoredArticleSnapshot {
  return {
    sourceUrl: article.sourceUrl,
    finalUrl: article.finalUrl,
    html: article.html,
    contentType: article.contentType,
    fetchedAt: article.fetchedAt,
    scraperId: article.scraperId,
  };
}

function toEntity(article: StoredArticleSnapshot): ArticleSnapshot {
  return new ArticleSnapshotEntity(article);
}

function normalizeSourceUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function isStoredArticle(value: unknown): value is StoredArticleSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return typeof entry.sourceUrl === "string" &&
    typeof entry.finalUrl === "string" &&
    typeof entry.html === "string" &&
    (typeof entry.contentType === "string" || entry.contentType === null) &&
    typeof entry.fetchedAt === "string" &&
    typeof entry.scraperId === "string";
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "ENOENT";
}
