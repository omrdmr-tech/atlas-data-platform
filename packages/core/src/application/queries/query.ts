export interface Query<TResponse> {
  readonly type: string;
  readonly responseType?: TResponse;
}
