import type {
  ProxyEndpoint,
  ProxyFailureReason,
  ProxyProvider,
} from "../../../application/ports/proxy-provider.js";

interface ProxyState {
  readonly endpoint: ProxyEndpoint;
  failures: number;
  successes: number;
  available: boolean;
}

export class InMemoryProxyProvider
  implements ProxyProvider
{
  private readonly proxies: ProxyState[] = [];
  private nextIndex = 0;

  public constructor(
    proxies: readonly ProxyEndpoint[]
  ) {
    if (proxies.length === 0) {
      throw new Error(
        "At least one proxy is required."
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
        available: true,
      });
    }
  }

  public async acquire(): Promise<ProxyEndpoint | null> {
    if (this.proxies.length === 0) {
      return null;
    }

    for (let offset = 0; offset < this.proxies.length; offset++) {
      const index =
        (this.nextIndex + offset) %
        this.proxies.length;

      const proxy = this.proxies[index];

      if (!proxy.available) {
        continue;
      }

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
    proxy.available = true;
  }

  public async reportFailure(
    proxyId: string,
    reason: ProxyFailureReason
  ): Promise<void> {
    const proxy = this.findProxy(proxyId);

    proxy.failures++;

    if (
      reason === "blocked" ||
      reason === "rate-limited" ||
      reason === "network-error" ||
      reason === "timeout"
    ) {
      proxy.available = false;
    }
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

