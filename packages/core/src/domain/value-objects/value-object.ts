export abstract class ValueObject<T> {
  protected constructor(public readonly value: T) {}

  public equals(other: ValueObject<T>): boolean {
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }
}
