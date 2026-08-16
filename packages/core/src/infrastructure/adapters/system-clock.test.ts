import { test } from "node:test";
import assert from "node:assert/strict";
import { SystemClock } from "./system-clock.js";

test("SystemClock returns a Date", () => {
  const clock = new SystemClock();
  assert.ok(clock.now() instanceof Date);
});
