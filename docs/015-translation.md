# 015 - Translation Architecture

Version: 0.1
Status: Draft

## Purpose
Define provider-independent translation for all supported source languages.

## Flow
```text
Collected Content -> Language Detection -> Target Language -> Translation Provider -> Translated Content
```

## Requirements
- User selects the target language during initial setup.
- Existing records can be translated when required.
- Original content is retained.
- Translation failures never destroy original data.
- Provider selection is configurable.

Providers may be cloud services, AI services or local translation models.
