import type { ProxyEndpoint } from "./proxy-provider.js";

export interface ProxyTransportRequest {
  readonly url: string;

  readonly init?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly signal?: AbortSignal;
  };

  readonly proxy: ProxyEndpoint;
}

export interface ProxyTransportResponse {
  readonly url: string;
  readonly statusCode: number;
  readonly content: string;
  readonly contentType: string | null;
}

export interface ProxyTransport {
  execute(
    request: ProxyTransportRequest
  ): Promise<ProxyTransportResponse>;
}
