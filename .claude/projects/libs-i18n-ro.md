---

# Library: i18n Romanian language pack

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the Romanian language pack changes.

## Overview

The Romanian entry point (`@malva-ui/i18n/ro`) provides the complete Romanian `MlvLanguage` object for every localisable Malva UI component. Every key of `MlvLanguage` is translated; the pack is typed against that interface, so a missing key is a compile error.

## Public API

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `roLanguage` | `MlvLanguage` | Named export containing the Romanian language pack. |
| `default` | `MlvLanguage` | Default export of the same Romanian language pack. |

## Usage

```ts
import { provideMlvI18n } from "@malva-ui/i18n";

export const appConfig = {
  providers: [provideMlvI18n(() => import("@malva-ui/i18n/ro"))],
};
```
