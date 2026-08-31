---

# Library: i18n Simplified Chinese language pack

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the Simplified Chinese language pack changes.

## Overview

The Simplified Chinese entry point (`@malva-ui/i18n/zh-Hans`) provides the complete Simplified Chinese `MlvLanguage` object for every localisable Malva UI component. Every key of `MlvLanguage` is translated; the pack is typed against that interface, so a missing key is a compile error.

## Public API

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `zhHansLanguage` | `MlvLanguage` | Named export containing the Simplified Chinese language pack. |
| `default` | `MlvLanguage` | Default export of the same Simplified Chinese language pack. |

## Usage

```ts
import { provideMlvI18n } from "@malva-ui/i18n";

export const appConfig = {
  providers: [provideMlvI18n(() => import("@malva-ui/i18n/zh-Hans"))],
};
```
