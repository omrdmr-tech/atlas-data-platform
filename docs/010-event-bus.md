# 010 - Event Bus

Version: 0.1
Status: Draft

## Purpose
Provide decoupled communication between Atlas components.

## Event Fields
- Event ID
- Event type
- Timestamp
- Correlation ID
- Payload
- Version

## Examples
```text
SourceCreated
ScrapeStarted
ArticleParsed
TranslationCompleted
JobFailed
```

## Rules
- Publishers must not depend on subscribers.
- Event contracts must be versioned.
- Handlers should be idempotent where practical.
- Failures must be observable.
- Correlation IDs should follow asynchronous workflows.

The first implementation may be an in-process event bus.
