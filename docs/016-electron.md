# 016 - Electron Desktop Architecture

Version: 0.1
Status: Draft

## Purpose
Define the desktop application boundary.

## Process Model
```text
Electron Main Process
        |
        +-- Core/Application Services
        |
        +-- Secure IPC
                 |
                 v
          Renderer Process
```

## Main Process
Application lifecycle, secure IPC, native integrations and application-service startup.

## Renderer
UI, dashboard, configuration, job monitoring and user interaction.

## Security
- No unrestricted Node.js access in the renderer.
- IPC channels are explicit and validated.
- Secrets are not exposed to renderer code.
- External content is untrusted.

Electron remains a presentation layer; Core business logic stays Electron-independent.
