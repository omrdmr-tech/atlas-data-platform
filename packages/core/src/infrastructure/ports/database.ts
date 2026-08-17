import type { Transaction } from "./transaction.js";

export interface Database {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  createTransaction(): Promise<Transaction>;
}
