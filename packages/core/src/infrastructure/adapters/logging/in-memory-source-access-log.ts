import type {
  SourceAccessLog,
  SourceAccessLogEntry,
} from "../../../application/ports/source-access-log.js";

export class InMemorySourceAccessLog
  implements SourceAccessLog
{
  private readonly entries: SourceAccessLogEntry[] = [];

  public async append(
    entry: SourceAccessLogEntry
  ): Promise<void> {
    this.entries.push(entry);
  }

  public getAll(): readonly SourceAccessLogEntry[] {
    return [...this.entries];
  }

  public findByRequestId(
    requestId: string
  ): readonly SourceAccessLogEntry[] {
    return this.entries.filter(
      (entry) => entry.requestId === requestId
    );
  }

  public findBySourceId(
    sourceId: string
  ): readonly SourceAccessLogEntry[] {
    return this.entries.filter(
      (entry) => entry.sourceId === sourceId
    );
  }
}
