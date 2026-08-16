import type { Query } from "./query.js";

export interface QueryHandler<TQuery extends Query<TResponse>, TResponse> {
  execute(query: TQuery): Promise<TResponse>;
}
