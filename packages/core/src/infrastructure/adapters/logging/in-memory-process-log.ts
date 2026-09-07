import type {
  ProcessLog,
  ProcessLogEntry,
} from "../../../application/ports/process-log.js";

export class InMemoryProcessLog implements ProcessLog {
  private readonly entries: ProcessLogEntry[] = [];

  public async append(
    entry: ProcessLogEntry
  ): Promise<void> {
    this.entries.push(entry);
  }

  public getAll(): readonly ProcessLogEntry[] {
    return [...this.entries];
  }

  public findByRequestId(
    requestId: string
  ): readonly ProcessLogEntry[] {
    return this.entries.filter(
      (entry) => entry.requestId === requestId
    );
  }
}
