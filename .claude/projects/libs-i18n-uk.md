---

# Library: i18n Ukrainian language pack

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the Ukrainian language pack changes.

## Overview

The Ukrainian entry point (`@malva-ui/i18n/uk`) provides the complete Ukrainian `MlvLanguage` object for every localisable Malva UI component. Every key of `MlvLanguage` is translated; the pack is typed against that interface, so a missing key is a compile error.

## Public API

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `ukLanguage` | `MlvLanguage` | Named export containing the Ukrainian language pack. |
| `default` | `MlvLanguage` | Default export of the same Ukrainian language pack. |

## Usage

```ts
import { provideMlvI18n } from "@malva-ui/i18n";

export const appConfig = {
  providers: [provideMlvI18n(() => import("@malva-ui/i18n/uk"))],
};
```
