# 005 - Architecture Overview

Version: 0.1

Status: Draft

## Purpose

Define the high-level architecture of Atlas before implementation begins.

## Architectural Style

Atlas uses a modular architecture combining:

- Clean Architecture
- Domain Driven Design
- Plugin Architecture
- Event-Driven Architecture
- Pipeline Architecture
- Dependency Injection

## High-Level Layers

```text
+------------------------------------------------------+
|                    Presentation                      |
|              Electron / CLI / API                   |
+---------------------------+--------------------------+
                            |
+---------------------------v--------------------------+
|                    Application                       |
|        Use Cases / Commands / Queries / Jobs         |
+---------------------------+--------------------------+
                            |
+---------------------------v--------------------------+
|                      Domain                          |
| Entities / Value Objects / Domain Events / Rules     |
+---------------------------+--------------------------+
                            |
+---------------------------v--------------------------+
|                  Infrastructure                      |
| PostgreSQL / Redis / HTTP / Browser / Filesystem    |
+------------------------------------------------------+
```

## Core Rule

Dependencies must point inward.

```text
Presentation
     |
     v
Application
     |
     v
Domain
     ^
     |
Infrastructure
```

The Domain layer must not depend on infrastructure providers.

## Major Subsystems

### Source Management

Maintains source definitions, schedules, policies and scraper configuration.

### Scraping

Executes scraping through replaceable scraper plugins.

### Processing Pipeline

Transforms collected data through configurable processing stages.

### Translation

Provides provider-independent translation orchestration.

### AI

Provides provider-independent AI capabilities such as classification, extraction, summarization and enrichment.

### Job Engine

Controls asynchronous jobs, retries, priorities, states and execution history.

### Event Bus

Provides decoupled communication between application components.

### Persistence

Provides repositories and storage abstractions backed initially by PostgreSQL and Redis.

### Plugin System

Loads and manages replaceable platform capabilities without coupling the Core to individual providers.

## Architectural Constraints

- Core domain logic must not import infrastructure implementations.
- External providers must be accessed through interfaces or adapters.
- Long-running work must execute outside the UI thread.
- Configuration must remain external to business logic.
- Components should be independently testable.
- Observability must be available across asynchronous workflows.

## Evolution

Detailed component architecture, database architecture, plugin contracts and deployment architecture will be documented in subsequent architecture documents.
