export interface ApplicationService<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}
