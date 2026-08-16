import { test } from "node:test";
import assert from "node:assert/strict";
import { Container, createToken } from "./container.js";

interface Service {
  name: string;
}

test("Container resolves a registered dependency", () => {
  const container = new Container();
  const serviceToken = createToken<Service>("Service");

  container.register(serviceToken, () => ({ name: "Atlas" }));

  assert.equal(container.resolve(serviceToken).name, "Atlas");
});

test("Container returns the same instance for repeated resolution", () => {
  const container = new Container();
  const serviceToken = createToken<Service>("Service");

  container.register(serviceToken, () => ({ name: "Atlas" }));

  assert.equal(
    container.resolve(serviceToken),
    container.resolve(serviceToken)
  );
});

test("Container rejects unregistered dependencies", () => {
  const container = new Container();
  const serviceToken = createToken<Service>("Service");

  assert.throws(() => container.resolve(serviceToken), /not registered/);
});
