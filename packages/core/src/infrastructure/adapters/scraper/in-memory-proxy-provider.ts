import type {
  ProxyEndpoint,
  ProxyFailureReason,
  ProxyProvider,
} from "../../../application/ports/proxy-provider.js";

interface ProxyState {
  readonly endpoint: ProxyEndpoint;
  failures: number;
  successes: number;
  cooldownUntil: number | null;
}

export interface InMemoryProxyProviderOptions {
  readonly cooldownMs?: number;
  readonly now?: () => number;
}

export class InMemoryProxyProvider
  implements ProxyProvider
{
  private readonly proxies: ProxyState[] = [];
  private readonly cooldownMs: number;
  private readonly now: () => number;

  private nextIndex = 0;

  public constructor(
    proxies: readonly ProxyEndpoint[],
    options: InMemoryProxyProviderOptions = {}
  ) {
    if (proxies.length === 0) {
      throw new Error(
        "At least one proxy is required."
      );
    }

    if (
      options.cooldownMs !== undefined &&
      (!Number.isFinite(options.cooldownMs) ||
        options.cooldownMs < 0)
    ) {
      throw new Error(
        "Cooldown duration must be a non-negative finite number."
      );
    }

    const ids = new Set<string>();

    for (const proxy of proxies) {
      if (ids.has(proxy.id)) {
        throw new Error(
          `Proxy "${proxy.id}" is already registered.`
        );
      }

      ids.add(proxy.id);

      this.proxies.push({
        endpoint: proxy,
        failures: 0,
        successes: 0,
        cooldownUntil: null,
      });
    }

    this.cooldownMs =
      options.cooldownMs ?? 30_000;

    this.now = options.now ?? Date.now;
  }

  public async acquire(): Promise<ProxyEndpoint | null> {
    if (this.proxies.length === 0) {
      return null;
    }

    const now = this.now();

    for (
      let offset = 0;
      offset < this.proxies.length;
      offset++
    ) {
      const index =
        (this.nextIndex + offset) %
        this.proxies.length;

      const proxy = this.proxies[index];

      if (!this.isAvailable(proxy, now)) {
        continue;
      }

      proxy.cooldownUntil = null;

      this.nextIndex =
        (index + 1) % this.proxies.length;

      return proxy.endpoint;
    }

    return null;
  }

  public async reportSuccess(
    proxyId: string
  ): Promise<void> {
    const proxy = this.findProxy(proxyId);

    proxy.successes++;
    proxy.failures = 0;
    proxy.cooldownUntil = null;
  }

  public async reportFailure(
    proxyId: string,
    reason: ProxyFailureReason
  ): Promise<void> {
    const proxy = this.findProxy(proxyId);

    proxy.failures++;

    if (shouldCooldown(reason)) {
      proxy.cooldownUntil =
        this.now() + this.cooldownMs;
    }
  }

  private isAvailable(
    proxy: ProxyState,
    now: number
  ): boolean {
    if (proxy.cooldownUntil === null) {
      return true;
    }

    if (now >= proxy.cooldownUntil) {
      proxy.cooldownUntil = null;
      return true;
    }

    return false;
  }

  private findProxy(
    proxyId: string
  ): ProxyState {
    const proxy = this.proxies.find(
      (candidate) =>
        candidate.endpoint.id === proxyId
    );

    if (!proxy) {
      throw new Error(
        `Proxy "${proxyId}" is not registered.`
      );
    }

    return proxy;
  }
}

function shouldCooldown(
  reason: ProxyFailureReason
): boolean {
  return (
    reason === "blocked" ||
    reason === "rate-limited" ||
    reason === "network-error" ||
    reason === "timeout"
  );
}
