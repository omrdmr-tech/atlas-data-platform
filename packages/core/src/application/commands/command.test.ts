import { test } from "node:test";
import assert from "node:assert/strict";
import type { Command } from "./command.js";
import type { CommandHandler } from "./command-handler.js";

class TestCommand implements Command {
  public readonly type = "TestCommand";
}

class TestHandler implements CommandHandler<TestCommand, string> {
  public async execute(command: TestCommand): Promise<string> {
    return command.type;
  }
}

test("Command handler executes a command", async () => {
  const handler = new TestHandler();
  assert.equal(await handler.execute(new TestCommand()), "TestCommand");
});
