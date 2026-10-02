import assert from "node:assert/strict";
import test from "node:test";

import { ArticleSnapshot } from "../../domain/entities/article-snapshot.js";
import type { ScraperOrchestrationResult } from "../ports/scraper-orchestrator.js";
import { CaptureArticle } from "./capture-article.js";

const fixedDate = new Date("2026-10-02T12:00:00.000Z");

function harness(content = "<article>Captured news</article>") {
  const calls: string[] = [];
  const saved: ArticleSnapshot[] = [];
  const scraper = {
    async execute(request: { url: string }): Promise<ScraperOrchestrationResult> {
      calls.push(request.url);
      return {
        result: {
          url: "https://example.com/redirected-article",
          statusCode: 200,
          content,
          contentType: "text/html",
        },
        scraperId: "http-scraper",
        failures: [],
        attemptHistory: [],
      };
    },
  };
  const repository = {
    async findById() { return null; },
    async findRecent() { return []; },
    async save(article: ArticleSnapshot) { saved.push(article); },
  };
  const clock = { now: () => fixedDate };

  return {
    useCase: new CaptureArticle(scraper, repository, clock),
    calls,
    saved,
  };
}

test("CaptureArticle stores the returned HTML snapshot", async () => {
  const { useCase, calls, saved } = harness();

  const result = await useCase.execute({
    url: "https://example.com/story#section",
  });

  assert.deepEqual(calls, ["https://example.com/story"]);
  assert.equal(result.sourceUrl, "https://example.com/story");
  assert.equal(result.finalUrl, "https://example.com/redirected-article");
  assert.equal(result.html, "<article>Captured news</article>");
  assert.equal(result.fetchedAt, fixedDate.toISOString());
  assert.equal(saved[0], result);
});

test("CaptureArticle extracts language and region from page metadata", async () => {
  const { useCase } = harness('<html lang="tr-TR"><head><meta name="geo.region" content="TR-34"></head><body><article>Haber</article></body></html>');
  const result = await useCase.execute({ url: "https://example.com/story" });
  assert.equal(result.language, "tr");
  assert.equal(result.region, "TR-34");
});

test("CaptureArticle derives country from locale when region metadata is missing", async () => {
  const { useCase } = harness('<html lang="en-US"><article>News</article></html>');
  const result = await useCase.execute({ url: "https://example.com/story" });
  assert.equal(result.language, "en");
  assert.equal(result.region, "US");
});

test("CaptureArticle rejects invalid URLs before scraping", async () => {
  const { useCase, calls } = harness();

  await assert.rejects(
    useCase.execute({ url: "file:///tmp/article.html" }),
    /HTTP or HTTPS/
  );
  assert.equal(calls.length, 0);
});

test("CaptureArticle does not save an empty scrape result", async () => {
  const { useCase, saved } = harness("  \n ");

  await assert.rejects(
    useCase.execute({ url: "https://example.com/story" }),
    /empty article snapshot/
  );
  assert.equal(saved.length, 0);
});
