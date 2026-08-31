---

# Library: i18n Turkish language pack

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the Turkish language pack changes.

## Overview

The Turkish entry point (`@malva-ui/i18n/tr`) provides the complete Turkish `MlvLanguage` object for every localisable Malva UI component. Every key of `MlvLanguage` is translated; the pack is typed against that interface, so a missing key is a compile error.

## Public API

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `trLanguage` | `MlvLanguage` | Named export containing the Turkish language pack. |
| `default` | `MlvLanguage` | Default export of the same Turkish language pack. |

## Usage

```ts
import { provideMlvI18n } from "@malva-ui/i18n";

export const appConfig = {
  providers: [provideMlvI18n(() => import("@malva-ui/i18n/tr"))],
};
```
