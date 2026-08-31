---

# Library: i18n English language pack

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the English language pack changes.

## Overview

The English entry point (`@malva-ui/i18n/en`) provides the complete default English `MlvLanguage` object for every localisable Malva UI component.

## Public API

| Export       | Kind          | Description                                        |
| ------------ | ------------- | -------------------------------------------------- |
| `enLanguage` | `MlvLanguage` | Named export containing the English language pack. |
| `default`    | `MlvLanguage` | Default export of the same English language pack.  |

## Usage

```ts
import { provideMlvI18n } from '@malva-ui/i18n';

export const appConfig = {
  providers: [provideMlvI18n(() => import('@malva-ui/i18n/en'))],
};
```
