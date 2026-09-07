import type {
  SourceAccessLog,
  SourceAccessLogEntry,
} from "../../../application/ports/source-access-log.js";

import type {
  SourceHealthStore,
} from "../../../application/ports/source-health.js";

export class HealthAwareSourceAccessLog
  implements SourceAccessLog
{
  public constructor(
    private readonly delegate: SourceAccessLog,
    private readonly healthStore: SourceHealthStore
  ) {}

  public async append(
    entry: SourceAccessLogEntry
  ): Promise<void> {
    await this.delegate.append(entry);

    this.healthStore.recordAccess({
      sourceId: entry.sourceId,
      domain: entry.domain,
      scraperId: entry.scraperId,
      accessType: entry.accessType,
      status: entry.accessStatus,
      success:
        entry.accessStatus === "accessible" &&
        entry.contentAvailable,
      occurredAt: entry.detectedAt,
    });
  }

  public getAll(): readonly SourceAccessLogEntry[] {
    return this.delegate.getAll();
  }

  public findByRequestId(
    requestId: string
  ): readonly SourceAccessLogEntry[] {
    return this.delegate.findByRequestId(requestId);
  }

  public findBySourceId(
    sourceId: string
  ): readonly SourceAccessLogEntry[] {
    return this.delegate.findBySourceId(sourceId);
  }
}