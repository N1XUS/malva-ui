---

# Library: kbd

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

The Kbd library (`@malva-ui/core/kbd`) provides a purely presentational `mlv-kbd` component that renders keyboard shortcuts as styled `<kbd>` HTML elements. It performs OS-aware label resolution at initialization: on macOS, modifier keys are shown as symbols (⌘, ⌃, ⇧, ⌥); on Windows and Linux they are shown as text (Ctrl, Shift, Alt).

## Component

### MlvKbd (mlv-kbd)

**File:** `libs/core/kbd/src/lib/kbd/kbd.ts`

Renders an ordered array of key names as `<kbd class="mlv-kbd__key">` elements separated by a configurable separator string. Purely presentational — no interaction, no forms, no state beyond its inputs.

#### Inputs

| Input       | Type          | Default  | Description                           |
| ----------- | ------------- | -------- | ------------------------------------- |
| `keys`      | `MlvKbdKey[]` | required | Ordered list of key names to display. |
| `separator` | `string`      | `'+'`    | String rendered between key elements. |

#### Host

- `class="mlv-kbd"` (static)
- `[attr.aria-label]` — computed joined label for screen readers

## Key Resolution

OS detection via PLATFORM_ID + isPlatformBrowser + navigator.platform/userAgent.

| MlvKbdKey          | macOS      | Win/Linux  |
| ------------------ | ---------- | ---------- |
| cmd, command, meta | ⌘          | Ctrl       |
| ctrl, control      | ⌃          | Ctrl       |
| shift              | ⇧          | Shift      |
| alt, option        | ⌥          | Alt        |
| enter, return      | ↵          | Enter      |
| backspace          | ⌫          | Backspace  |
| delete             | ⌦          | Del        |
| escape, esc        | ⎋          | Esc        |
| tab                | ⇥          | Tab        |
| space              | ␣          | Space      |
| up/down/left/right | arrows     | arrows     |
| anything else      | uppercased | uppercased |

## Styling

File: `libs/core/kbd/src/lib/kbd/kbd.scss`
BEM block: `mlv-kbd`

- `.mlv-kbd` — host, inline-flex row
- `.mlv-kbd__key` — individual kbd element, raised card appearance
- `.mlv-kbd__separator` — separator span, aria-hidden="true"

## Usage

```ts
import { MlvKbd } from '@malva-ui/core/kbd';

@Component({
  imports: [MlvKbd],
  template: `<mlv-kbd [keys]="['cmd', 'k']" />`,
})
```

## Dependencies

- @angular/core
- @angular/common (isPlatformBrowser)

## Testing

Run: `pnpm nx test core-kbd`
