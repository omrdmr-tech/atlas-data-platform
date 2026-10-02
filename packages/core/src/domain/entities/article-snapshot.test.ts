import assert from "node:assert/strict";
import test from "node:test";

import { ArticleSnapshot } from "./article-snapshot.js";

function snapshot(overrides: Partial<ConstructorParameters<typeof ArticleSnapshot>[0]> = {}) {
  return new ArticleSnapshot({
    sourceUrl: "https://example.com/article#top",
    finalUrl: "https://example.com/article?ref=home",
    html: "<article>Full source</article>",
    contentType: "text/html; charset=utf-8",
    fetchedAt: "2026-10-02T10:00:00.000Z",
    scraperId: "http-scraper",
    ...overrides,
  });
}

test("ArticleSnapshot normalizes URLs and capture time", () => {
  const article = snapshot();

  assert.equal(article.id, "https://example.com/article");
  assert.equal(article.sourceUrl, article.id);
  assert.equal(article.finalUrl, "https://example.com/article?ref=home");
  assert.equal(article.fetchedAt, "2026-10-02T10:00:00.000Z");
  assert.equal(article.html, "<article>Full source</article>");
});

test("ArticleSnapshot rejects non-HTTP URLs", () => {
  assert.throws(
    () => snapshot({ sourceUrl: "file:///etc/passwd" }),
    /HTTP or HTTPS/
  );
});

test("ArticleSnapshot rejects URL credentials", () => {
  assert.throws(
    () => snapshot({ sourceUrl: "https://user:secret@example.com/article" }),
    /without credentials/
  );
});

test("ArticleSnapshot rejects invalid capture times", () => {
  assert.throws(
    () => snapshot({ fetchedAt: "not-a-date" }),
    /valid date/
  );
});
