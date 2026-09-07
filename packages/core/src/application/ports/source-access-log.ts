import type {
  SourceAccessDetection,
  SourceAccessStatus,
  SourceAccessType,
} from "./source-access-detector.js";

export interface SourceAccessLogEntry {
  readonly requestId: string;
  readonly sourceId: string;
  readonly url: string;
  readonly domain: string;
  readonly accessStatus: SourceAccessStatus;
  readonly accessType: SourceAccessType;
  readonly detectedAt: string;
  readonly scraperId: string;
  readonly httpStatus: number | null;
  readonly requiresLogin: boolean;
  readonly requiresSubscription: boolean;
  readonly paywallDetected: boolean;
  readonly captchaDetected: boolean;
  readonly contentAvailable: boolean;
}

export interface SourceAccessLog {
  append(entry: SourceAccessLogEntry): Promise<void>;
  getAll(): readonly SourceAccessLogEntry[];
  findByRequestId(requestId: string): readonly SourceAccessLogEntry[];
  findBySourceId(sourceId: string): readonly SourceAccessLogEntry[];
}

export function createSourceAccessLogEntry(
  input: Omit<SourceAccessLogEntry, keyof SourceAccessDetection>
    & SourceAccessDetection
): SourceAccessLogEntry {
  return { ...input };
}
