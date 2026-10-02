import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ArticleSnapshot } from "@atlas/core";
import { FileArticleSnapshotRepository } from "./file-article-snapshot-repository.js";

function article(sourceUrl: string, html: string, fetchedAt: string) {
  return new ArticleSnapshot({
    sourceUrl,
    finalUrl: sourceUrl,
    html,
    contentType: "text/html",
    fetchedAt,
    scraperId: "http-scraper",
  });
}

async function withRepository(
  run: (repository: FileArticleSnapshotRepository, filePath: string) => Promise<void>
) {
  const directory = await mkdtemp(join(tmpdir(), "atlas-article-archive-"));
  const filePath = join(directory, "articles.json");

  try {
    await run(new FileArticleSnapshotRepository(filePath), filePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("file article repository saves and retrieves full snapshots", async () => {
  await withRepository(async (repository, filePath) => {
    const captured = article(
      "https://example.com/story",
      "<article>Full copy</article>",
      "2026-10-02T10:00:00.000Z"
    );

    await repository.save(captured);

    assert.equal((await repository.findById(captured.id))?.html, captured.html);
    assert.equal((await readFile(filePath, "utf8")).includes(captured.html), true);
  });
});

test("file article repository updates an existing URL and serializes concurrent saves", async () => {
  await withRepository(async (repository) => {
    const first = article(
      "https://example.com/first",
      "first",
      "2026-10-02T10:00:00.000Z"
    );
    const updated = article(
      "https://example.com/first#top",
      "updated",
      "2026-10-02T11:00:00.000Z"
    );
    const second = article(
      "https://example.com/second",
      "second",
      "2026-10-02T12:00:00.000Z"
    );

    await repository.save(first);
    await Promise.all([repository.save(updated), repository.save(second)]);

    const recent = await repository.findRecent();
    assert.equal(recent.length, 2);
    assert.equal((await repository.findById(first.id))?.html, "updated");
    assert.equal(recent[0]?.sourceUrl, second.sourceUrl);
  });
});

test("file article repository rejects invalid list limits", async () => {
  await withRepository(async (repository) => {
    await assert.rejects(repository.findRecent(501), /between 1 and 500/);
  });
});
