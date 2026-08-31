---

# Library: i18n testing

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the i18n testing helpers change.

## Overview

The testing entry point (`@malva-ui/i18n/testing`) supplies English-backed providers for component tests that consume Malva UI internationalisation tokens.

## Public API

| Export                  | Kind     | Description                                                         |
| ----------------------- | -------- | ------------------------------------------------------------------- |
| `provideMlvI18nTesting` | Function | Provides every Malva UI i18n token with its default English signal. |
| `i18nTestProvider`      | Function | Provides one i18n token with optional per-test message overrides.   |

## Usage

```ts
await TestBed.configureTestingModule({
  imports: [MlvAlert],
  providers: [provideMlvI18nTesting()],
}).compileComponents();
```
