---

# Library: i18n Polish language pack

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the Polish language pack changes.

## Overview

The Polish entry point (`@malva-ui/i18n/pl`) provides the complete Polish `MlvLanguage` object for every localisable Malva UI component. Every key of `MlvLanguage` is translated; the pack is typed against that interface, so a missing key is a compile error.

## Public API

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `plLanguage` | `MlvLanguage` | Named export containing the Polish language pack. |
| `default` | `MlvLanguage` | Default export of the same Polish language pack. |

## Usage

```ts
import { provideMlvI18n } from "@malva-ui/i18n";

export const appConfig = {
  providers: [provideMlvI18n(() => import("@malva-ui/i18n/pl"))],
};
```
