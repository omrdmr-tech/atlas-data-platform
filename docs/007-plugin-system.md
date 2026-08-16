# 007 - Plugin System

Version: 0.1
Status: Draft

## Purpose
Define a provider-independent plugin architecture for Atlas.

## Plugin Contract
A plugin exposes a unique ID, name, version, capabilities, configuration schema, lifecycle hooks and compatibility information.

## Lifecycle
```text
Discover -> Validate -> Load -> Initialize -> Start -> Stop -> Unload
```

## Initial Plugin Types
- Scraper
- Processor
- Translator
- AI Provider
- Storage Adapter
- Notification Provider

## Rules
- Plugins must not modify Core state directly.
- Plugin APIs must be versioned.
- Plugin failures should be isolated where practical.
- Credentials must remain in secure configuration.
