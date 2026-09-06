export interface ProxyEndpoint {
  readonly id: string;
  readonly url: string;
  readonly username?: string;
  readonly password?: string;
}

export interface ProxyProvider {
  acquire(): Promise<ProxyEndpoint | null>;

  reportSuccess(proxyId: string): Promise<void>;

  reportFailure(
    proxyId: string,
    reason: ProxyFailureReason
  ): Promise<void>;
}

export type ProxyFailureReason =
  | "blocked"
  | "rate-limited"
  | "server-error"
  | "timeout"
  | "network-error"
  | "http-error"
  | "unknown";
