# 004 - System Context

Version: 0.1

Status: Draft

## Purpose

Define the high-level boundary of Atlas and its primary external actors and systems.

## System

Atlas Data Platform is the central system responsible for collecting, processing, enriching, translating, storing and exposing data.

## External Actors

### User

Configures sources, scraping policies, processing pipelines, translation settings and system preferences.

### Source

An external website, RSS feed, API, document repository or other supported data provider.

### AI Provider

An optional external or local AI service used for enrichment, classification, extraction and analysis.

### Translation Provider

An optional external or local translation service used to translate collected content into the configured target language.

### Notification Provider

An optional service used for operational notifications and alerts.

## External Systems

```text
                         +------------------+
                         |      User        |
                         +--------+---------+
                                  |
                                  v
+----------------+       +--------+---------+       +------------------+
| Data Sources   | ----> |                  | ----> | AI Providers     |
| Web/RSS/API    |       |      ATLAS       |       +------------------+
+----------------+       |                  |
                         | Data Collection   | ----> +------------------+
                         | & Processing      |       | Translation      |
                         | Platform          |       | Providers        |
                         +--------+---------+       +------------------+
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
             +-------------+             +-------------+
             | PostgreSQL  |             |   Redis     |
             +-------------+             +-------------+
```

## Architectural Boundary

Atlas owns:

- Source configuration
- Scraping orchestration
- Data processing
- Pipeline execution
- Translation orchestration
- AI orchestration
- Job management
- Persistence
- Observability

External providers remain replaceable integrations.

## Principles

- External providers must not be coupled directly to the domain layer.
- Provider integrations must be accessed through abstractions.
- Raw collected data should be retained where required for recovery and reprocessing.
- Optional external services must not make the core architecture provider-dependent.
