# 014 - Redis Infrastructure

Version: 0.1
Status: Draft

## Purpose
Define Redis for transient and high-speed workloads.

## Initial Uses
- Job queues
- Distributed locks where required
- Cache
- Rate-limit state
- Short-lived coordination

## Rules
- Redis is not the authoritative long-term store.
- Durable business records belong in PostgreSQL.
- TTL must be explicit for temporary data.
- Cache failure must be handled deliberately.

```text
Application -> Redis Interfaces -> Redis Adapter -> Redis
```
