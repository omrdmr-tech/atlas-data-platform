# 006 - Clean Architecture

Version: 0.1

Status: Draft

## Purpose

Define dependency boundaries so that Atlas business logic remains independent from frameworks, databases and external providers.

## Layers

### Domain

Contains the business model and rules.

Examples:

- Entities
- Value Objects
- Domain Events
- Domain Services
- Repository Contracts

The Domain layer must not depend on Application, Infrastructure or Presentation implementations.

### Application

Contains use cases and application orchestration.

Examples:

- Commands
- Queries
- Use Cases
- Application Services
- DTOs
- Ports

Application code may depend on Domain abstractions.

### Infrastructure

Contains technical implementations.

Examples:

- PostgreSQL repositories
- Redis adapters
- HTTP clients
- Browser automation
- File storage
- External provider adapters

Infrastructure implements contracts defined by inner layers.

### Presentation

Contains user-facing entry points.

Examples:

- Electron UI
- CLI
- API
- IPC handlers

Presentation invokes Application use cases and must not contain domain business rules.

## Dependency Direction

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

Dependencies point toward the Domain.

## Example

```text
Domain
  |
  +-- IScraper
  |
  +-- Article
  |
  +-- ArticleRepository
          ^
          |
Infrastructure
  |
  +-- PlaywrightScraper
  +-- PostgreSQLArticleRepository
```

The Domain defines contracts. Infrastructure supplies implementations.

## Rules

- Domain must remain framework-independent.
- Application must not directly instantiate infrastructure services.
- Infrastructure dependencies must be injected through abstractions.
- Presentation must call Application use cases.
- Business rules must not be placed in controllers, UI components or database adapters.
- External provider SDKs must remain outside the Domain layer.
- Unit tests for Domain must run without databases, browsers or network access.

## Dependency Injection

Dependencies shall be supplied through constructors or an equivalent explicit mechanism.

Example:

```text
UseCase
   |
   +-- ArticleRepository
   +-- EventPublisher
```

The concrete implementations are selected by the composition root.

## Composition Root

The application startup layer is responsible for wiring interfaces to implementations.

```text
Application
    |
Interfaces
    ^
    |
Composition Root
    |
Implementations
```

Only the composition root should decide which infrastructure implementation is active.

## Benefits

- Replaceable infrastructure
- Easier testing
- Reduced vendor lock-in
- Clear module boundaries
- Long-term maintainability
- Safer architectural evolution
