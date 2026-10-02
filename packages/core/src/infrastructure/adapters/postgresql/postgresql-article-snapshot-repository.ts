import type { ArticleSnapshot } from "../../../domain/entities/article-snapshot.js";
import { ArticleSnapshot as ArticleSnapshotEntity } from "../../../domain/entities/article-snapshot.js";
import type { ArticleSnapshotRepository } from "../../../application/ports/article-snapshot-repository.js";
import type { Database } from "../../ports/database.js";

interface ArticleSnapshotRow {
  source_url: string;
  final_url: string;
  html: string;
  content_type: string | null;
  fetched_at: Date | string;
  scraper_id: string;
}

export class PostgreSQLArticleSnapshotRepository
  implements ArticleSnapshotRepository
{
  private initialization: Promise<void> | null = null;

  public constructor(private readonly database: Database) {}

  public async findById(sourceUrl: string): Promise<ArticleSnapshot | null> {
    await this.ensureInitialized();
    const transaction = await this.database.createTransaction();

    try {
      await transaction.begin();
      const result = await transaction.query<ArticleSnapshotRow>(
        `SELECT source_url, final_url, html, content_type, fetched_at, scraper_id
         FROM article_snapshots
         WHERE source_url = $1
         LIMIT 1`,
        [sourceUrl]
      );
      await transaction.commit();

      return result.rows[0] ? mapRow(result.rows[0]) : null;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async findRecent(limit = 50): Promise<readonly ArticleSnapshot[]> {
    if (!Number.isInteger(limit) || limit <= 0 || limit > 500) {
      throw new Error("limit must be an integer between 1 and 500.");
    }

    await this.ensureInitialized();
    const transaction = await this.database.createTransaction();

    try {
      await transaction.begin();
      const result = await transaction.query<ArticleSnapshotRow>(
        `SELECT source_url, final_url, html, content_type, fetched_at, scraper_id
         FROM article_snapshots
         ORDER BY fetched_at DESC
         LIMIT $1`,
        [limit]
      );
      await transaction.commit();

      return result.rows.map(mapRow);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async save(article: ArticleSnapshot): Promise<void> {
    await this.ensureInitialized();
    const transaction = await this.database.createTransaction();

    try {
      await transaction.begin();
      await transaction.query(
        `INSERT INTO article_snapshots
           (source_url, final_url, html, content_type, fetched_at, scraper_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (source_url) DO UPDATE SET
           final_url = EXCLUDED.final_url,
           html = EXCLUDED.html,
           content_type = EXCLUDED.content_type,
           fetched_at = EXCLUDED.fetched_at,
           scraper_id = EXCLUDED.scraper_id`,
        [
          article.sourceUrl,
          article.finalUrl,
          article.html,
          article.contentType,
          article.fetchedAt,
          article.scraperId,
        ]
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.createTable().catch((error: unknown) => {
        this.initialization = null;
        throw error;
      });
    }

    await this.initialization;
  }

  private async createTable(): Promise<void> {
    const transaction = await this.database.createTransaction();

    try {
      await transaction.begin();
      await transaction.query(`
        CREATE TABLE IF NOT EXISTS article_snapshots (
          source_url TEXT PRIMARY KEY,
          final_url TEXT NOT NULL,
          html TEXT NOT NULL,
          content_type TEXT,
          fetched_at TIMESTAMPTZ NOT NULL,
          scraper_id TEXT NOT NULL
        )
      `);
      await transaction.query(`
        CREATE INDEX IF NOT EXISTS idx_article_snapshots_fetched_at
          ON article_snapshots (fetched_at DESC)
      `);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

function mapRow(row: ArticleSnapshotRow): ArticleSnapshot {
  return new ArticleSnapshotEntity({
    sourceUrl: row.source_url,
    finalUrl: row.final_url,
    html: row.html,
    contentType: row.content_type,
    fetchedAt: row.fetched_at instanceof Date
      ? row.fetched_at.toISOString()
      : row.fetched_at,
    scraperId: row.scraper_id,
  });
}
