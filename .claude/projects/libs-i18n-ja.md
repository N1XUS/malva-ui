---

# Library: i18n Japanese language pack

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the Japanese language pack changes.

## Overview

The Japanese entry point (`@malva-ui/i18n/ja`) provides the complete Japanese `MlvLanguage` object for every localisable Malva UI component. Every key of `MlvLanguage` is translated; the pack is typed against that interface, so a missing key is a compile error.

## Public API

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `jaLanguage` | `MlvLanguage` | Named export containing the Japanese language pack. |
| `default` | `MlvLanguage` | Default export of the same Japanese language pack. |

## Usage

```ts
import { provideMlvI18n } from "@malva-ui/i18n";

export const appConfig = {
  providers: [provideMlvI18n(() => import("@malva-ui/i18n/ja"))],
};
```
