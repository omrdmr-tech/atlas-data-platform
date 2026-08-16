# 012 - Observability

Version: 0.1
Status: Draft

## Purpose
Define logging, metrics and tracing requirements.

## Logging
Logs must be structured, timestamped, levelled, correlated and safe from secret leakage.

Levels:
```text
trace debug info warn error fatal
```

## Correlation
Long-running workflows should carry correlation ID, job ID, pipeline ID and source ID where applicable.

## Metrics
- Jobs queued/running/failed
- Job duration
- Scrape success rate
- Pipeline stage duration
- Translation failures
- Worker utilization

Secrets must never appear in telemetry.
