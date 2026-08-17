export interface Transaction {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;

  query<T = Record<string, unknown>>(
    text: string,
    parameters?: readonly unknown[]
  ): Promise<{
    rows: T[];
    rowCount: number | null;
  }>;
}
