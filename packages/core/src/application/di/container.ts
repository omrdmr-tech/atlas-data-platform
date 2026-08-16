export type Token<T> = symbol & { readonly __type?: T };

export class Container {
  private readonly factories = new Map<symbol, () => unknown>();
  private readonly instances = new Map<symbol, unknown>();

  public register<T>(token: Token<T>, factory: () => T): void {
    this.factories.set(token, factory);
  }

  public resolve<T>(token: Token<T>): T {
    const existing = this.instances.get(token);
    if (existing !== undefined) {
      return existing as T;
    }

    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error("Dependency is not registered.");
    }

    const instance = factory() as T;
    this.instances.set(token, instance);
    return instance;
  }
}

export function createToken<T>(description: string): Token<T> {
  return Symbol(description) as Token<T>;
}
