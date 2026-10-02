import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { FileSourceCaptureLog } from "./file-source-capture-log.js";

test("capture log records all submitted URLs and updates metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-source-log-"));
  const filePath = join(directory, "sources.json");
  try {
    const log = new FileSourceCaptureLog(filePath);
    const urls = ["https://example.com/a", "https://example.com/b"];
    const batchId = await log.beginBatch(urls);
    await log.complete(batchId, urls[0]!, { status: "success", details: null, language: "en", region: "US" });
    await log.complete(batchId, urls[1]!, { status: "failed", details: "timeout" });
    const sources = await log.listSources();
    assert.equal(sources.length, 2);
    assert.equal(sources[0]?.language, "en");
    assert.equal(sources[1]?.lastError, "timeout");
    const stored = JSON.parse(await readFile(filePath, "utf8")) as { logs: Array<{ status: string }> };
    assert.deepEqual(stored.logs.map(({ status }) => status), ["success", "failed"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
