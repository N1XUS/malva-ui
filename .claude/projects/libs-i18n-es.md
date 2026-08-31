---

# Library: i18n Spanish language pack

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the Spanish language pack changes.

## Overview

The Spanish entry point (`@malva-ui/i18n/es`) provides the complete Spanish `MlvLanguage` object for every localisable Malva UI component.

## Public API

| Export       | Kind          | Description                                        |
| ------------ | ------------- | -------------------------------------------------- |
| `esLanguage` | `MlvLanguage` | Named export containing the Spanish language pack. |
| `default`    | `MlvLanguage` | Default export of the same Spanish language pack.  |

## Usage

```ts
import { provideMlvI18n } from '@malva-ui/i18n';

export const appConfig = {
  providers: [provideMlvI18n(() => import('@malva-ui/i18n/es'))],
};
```
