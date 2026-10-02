import type { ArticleSnapshot } from "../../domain/entities/article-snapshot.js";

export interface ArticleSnapshotRepository {
  findById(sourceUrl: string): Promise<ArticleSnapshot | null>;
  findRecent(limit?: number): Promise<readonly ArticleSnapshot[]>;
  save(article: ArticleSnapshot): Promise<void>;
}
