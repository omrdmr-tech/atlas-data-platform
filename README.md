# Atlas Data Platform

> Enterprise-grade, plugin-based, AI-ready data collection and processing platform.

> **Status:** 🚧 Under Active Development

---

## Overview

Atlas Data Platform is a modular, extensible, and enterprise-focused platform designed to collect, process, translate, analyze, and index structured and unstructured data from multiple sources.

The platform is not limited to news websites. It is designed as a general-purpose data acquisition and processing system capable of supporting websites, RSS feeds, APIs, documents, social platforms, and future data sources.

## Run the desktop MVP

```powershell
pnpm install
pnpm start
```

The first desktop MVP accepts up to 500 HTTP or HTTPS article addresses per batch, one per line. Atlas fetches each page, stores its original HTML copy in a local archive, and displays the readable page text in the reader. Re-adding an address updates its saved copy. Translation is planned for a later version.

The renderer has no direct Node.js access. Page scripts are not executed in the reader. The archive is stored in the Electron user-data folder on the current computer.

---

## Vision

Our goal is to build a platform that can:

* Collect data from thousands of sources simultaneously.
* Support multiple scraping engines.
* Process data through configurable pipelines.
* Translate content into multiple languages.
* Enrich content using AI.
* Detect duplicate and similar content.
* Store and index data efficiently.
* Provide APIs for external integrations.
* Scale from a single desktop installation to enterprise deployments.

---

## Core Principles

* Plugin-first architecture
* Event-driven communication
* Clean Architecture
* Domain Driven Design (DDD)
* Pipeline-based processing
* Configuration over hardcoded logic
* High observability
* Enterprise scalability

---

## Planned Features

### Data Collection

* Multi-engine scraping
* RSS support
* Sitemap support
* Browser automation
* Cookie management
* Proxy management
* Rate limiting
* Retry engine
* Scheduler
* Job queue

### Processing

* HTML parsing
* Content extraction
* Language detection
* Translation
* Keyword extraction
* Entity recognition
* Duplicate detection
* AI enrichment

### Storage

* PostgreSQL
* Redis
* pgvector
* Full-text search
* Raw data archive

### User Interface

* Electron Desktop Application
* Dashboard
* Job Monitor
* Pipeline Designer
* Plugin Manager
* Settings Center

---

## Planned Technologies

| Area               | Technology                  |
| ------------------ | --------------------------- |
| Desktop            | Electron                    |
| Language           | TypeScript                  |
| UI                 | React                       |
| Styling            | Tailwind CSS                |
| Database           | PostgreSQL                  |
| Cache              | Redis                       |
| ORM                | Drizzle ORM                 |
| Browser Automation | Playwright                  |
| HTTP               | Axios                       |
| AI                 | Provider-based Architecture |
| Build              | Vite                        |
| Package Manager    | pnpm                        |

---

## Repository Structure

```text
atlas-data-platform/
├── apps/
├── packages/
├── plugins/
├── docs/
├── tests/
├── scripts/
├── config/
├── resources/
└── .github/
```

---

## Documentation

Project documentation is stored under the `/docs` directory.

Documentation includes:

* Vision
* Requirements
* Architecture
* Database Design
* Plugin System
* Pipeline Engine
* Job Engine
* API
* Deployment
* Testing
* Roadmap
* Architecture Decision Records (ADR)

---

## Project Status

Current Phase:

**Phase 2 — Core Platform and Desktop MVP**

The core already includes scraper orchestration, retry/fallback strategies, health tracking, and an article capture/archive flow. The Electron desktop MVP now provides URL entry and a local article reader. Source management, scheduling, robust article extraction, translation, and packaging remain future work.

---

## Roadmap

* Phase 1 — Architecture
* Phase 2 — Core Platform
* Phase 3 — Infrastructure
* Phase 4 — Plugin System
* Phase 5 — Scraping Engines
* Phase 6 — Translation
* Phase 7 — AI Integration
* Phase 8 — Enterprise Features

---

## Contributing

Contribution guidelines will be available in `CONTRIBUTING.md`.

---

## Security

Please report security issues according to `SECURITY.md`.

---

## License

This project will be released under the MIT License.

---

## Maintainer

Project Owner: Han Uzay

Technical Architecture & Design: OpenAI ChatGPT Collaboration

---

> Build the architecture first. The code will follow.
