export abstract class Entity<TId> {
  public constructor(public readonly id: TId) {}
}
