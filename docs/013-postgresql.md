# 013 - PostgreSQL Persistence

Version: 0.1
Status: Draft

## Purpose
Define PostgreSQL as the primary relational persistence layer.

## Data
- Sources
- Jobs
- Pipeline definitions
- Articles
- Processing state
- Plugin metadata
- Configuration metadata

## Boundary
```text
Domain/Application -> Repository Interfaces -> PostgreSQL Adapter -> PostgreSQL
```

The Domain must not depend on PostgreSQL APIs.

## Requirements
- Schema changes use migrations.
- Indexes are designed deliberately.
- Multi-step atomic operations use transactions.
- Timestamps are consistent.
- Backup and recovery are considered part of persistence design.
