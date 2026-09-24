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
- No `role`, no `aria-*` — **never** an `aria-label`: ARIA 1.2 prohibits naming a generic element (axe `aria-prohibited-attr`, filed under `incomplete`, which `expectNoAxeViolations` does not fail on). Removed in #331; see `docs/migrations/2026-09-kbd-spoken-key-names.md`.

#### Accessibility

- First child: `<span class="cdk-visually-hidden">` holding the whole shortcut once, spelled with **spoken key names** joined by `' ' + separator + ' '` — `Command + K` (macOS), `Control + K` (Win/Linux), `Control – Shift – P` with `separator="–"`. Protected `_spokenText()` computed.
- Every `.mlv-kbd__key` and `.mlv-kbd__separator` is `aria-hidden="true"`, so glyphs are never read and nothing is read twice.
- Measured (Chromium 145 AX tree): one `StaticText "Command + K"`, host and caps ignored; a `<button>Search <mlv-kbd/></button>` is named `Search Command + K` (was `Search ⌘ + K`, from the prohibited label, while browse mode read the caps' text `⌘ K`).
- Relies on the global `.cdk-visually-hidden` rule shipped in `styles/malva-ui.css` (same as `mlv-label`, `mlv-chat`, `mlv-tiles`).
- Spoken names are English, like the Win/Linux labels; no i18n slice.
- `host.textContent` includes the spoken text (`Control + KCtrl+K`); read caps through `.mlv-kbd__key`.

## Key Resolution

OS detection via PLATFORM_ID + isPlatformBrowser + navigator.platform/userAgent. Server render → Win/Linux column.

| MlvKbdKey          | macOS      | Win/Linux  | Spoken (macOS)         | Spoken (Win/Linux)     |
| ------------------ | ---------- | ---------- | ---------------------- | ---------------------- |
| cmd, command       | ⌘          | Ctrl       | Command                | Control                |
| meta               | ⌘          | Win        | Command                | Windows                |
| ctrl, control      | ⌃          | Ctrl       | Control                | Control                |
| shift              | ⇧          | Shift      | Shift                  | Shift                  |
| alt, option        | ⌥          | Alt        | Option                 | Alt                    |
| enter, return      | ↵          | Enter      | Return                 | Enter                  |
| backspace          | ⌫          | Backspace  | Delete                 | Backspace              |
| delete             | ⌦          | Del        | Forward Delete         | Delete                 |
| escape, esc        | ⎋          | Esc        | Escape                 | Escape                 |
| tab                | ⇥          | Tab        | Tab                    | Tab                    |
| space              | ␣          | Space      | Space                  | Space                  |
| up/down/left/right | arrows     | arrows     | Up Arrow … Right Arrow | Up Arrow … Right Arrow |
| home, end          | Home, End  | Home, End  | Home, End              | Home, End              |
| pageup, pagedown   | PgUp, PgDn | PgUp, PgDn | Page Up, Page Down     | Page Up, Page Down     |
| anything else      | uppercased | uppercased | = label                | = label                |

macOS spoken names are the keys' names on a Mac keyboard (`⌫` is "Delete", `⌦` "Forward Delete").
Lookups match the tables' own keys only (`hasOwnKey`): a key named after an `Object.prototype` member (`constructor`, `toString`) falls to "anything else".

## Styling

File: `libs/core/kbd/src/lib/kbd/kbd.scss`
BEM block: `mlv-kbd`

- `.mlv-kbd` — host, inline-flex row
- `.mlv-kbd__key` — individual kbd element, raised card appearance, aria-hidden="true"
- `.mlv-kbd__separator` — separator span, aria-hidden="true"
- The visually hidden spoken-text span carries only `cdk-visually-hidden` (absolutely positioned, so it takes no flex gap).

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

Run: `yarn nx test core-kbd`

- `kbd.spec.ts` § _screen-reader text (#331)_ — no host `aria-label`, caps/separators `aria-hidden`, spoken text per table (Win and emulated macOS via `vi.spyOn(navigator, 'platform', 'get')`), unknown-key fallback, `Object.prototype`-named keys treated as plain keys (both platforms), separator kept, follows `keys` changes.
- § _MlvKbd accessibility_ — full axe sweep per platform **plus** `runAxe(...).incomplete` must not contain `aria-prohibited-attr`.
