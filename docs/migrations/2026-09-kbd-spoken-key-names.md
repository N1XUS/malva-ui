# 2026-09 — `mlv-kbd` is read by key name, not through a prohibited `aria-label`

Applies to `@malva-ui/core/kbd` (`MlvKbd`, `mlv-kbd`). Fixes #331 (audit C038 /
H-12).

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped; the selector, both inputs (`keys`, `separator`), `MlvKbdKey`,
`MlvResolvedKey`, the visible key caps and every BEM class are unchanged, and
the rendered box is the same size (measured in Chromium with the shipped
`kbd.scss` and `malva-ui.css`: 82.38×24 px for `Ctrl + K`, 63.56×24 px for
`⌘ + K`, before and after). What moves is the ARIA the
component emits and the text assistive technology reads — VERSIONING §3 row 112
(_default behaviour … ARIA_ at an unchanged API). The issue filed it as a
patch; row 112 is where the library has classified every ARIA change at an
unchanged API, so it ships with `!`, which on `0.x` releases as `0.2.0`
(VERSIONING §7). The half that restores what the old code documented — a
"joined label for screen readers", built from `MlvResolvedKey.key`, "for aria
labelling" — is row 117.

## 1. What changed

**Before.** The host carried `aria-label` (a static `aria-label=""` plus an
`[attr.aria-label]` binding) and no role. ARIA 1.2 prohibits `aria-label` on a
generic element, so assistive technology is not required to use it, and axe
reports it as `aria-prohibited-attr` under `incomplete` — which
`expectNoAxeViolations` does not fail on, so the library's own sweep passed.
The label also joined the **display** labels, so it repeated the glyphs:
`⌘ + K` on macOS, `Ctrl + K` elsewhere. Measured in Chromium 145's
accessibility tree, the host was a named `generic "⌘ + K"` **and** exposed the
caps' own text under it (`⌘`, `K`; the `+` separator was already
`aria-hidden`) — so a screen reader either read the glyphs in browse mode,
without the `+`, or read the glyph label, and a `<button>` containing the hint
was named `Search ⌘ + K`.

**After.** The host carries no ARIA. The first child is a
`<span class="cdk-visually-hidden">` holding the shortcut once, spelled with
spoken key names and joined by the separator exactly as the label was
(`' ' + separator + ' '`); every `.mlv-kbd__key` gains `aria-hidden="true"`
beside the separators. Measured in the same Chromium, the subtree is one
`StaticText "Command + K"` (macOS) / `"Control + K"` (Win/Linux), the host and
caps are ignored, and the `<button>` is named `Search Command + K`. axe reports
nothing under `violations` **or** `incomplete`.

Spoken names follow the key table (macOS names are the keys' names on a Mac
keyboard; a key outside the table is spoken as its visible label):

| `keys` entry             | Visible (Mac / Win)      | Spoken (Mac)   | Spoken (Win/Linux) |
| ------------------------ | ------------------------ | -------------- | ------------------ |
| `cmd`, `command`         | `⌘` / `Ctrl`             | Command        | Control            |
| `meta`                   | `⌘` / `Win`              | Command        | Windows            |
| `ctrl`, `control`        | `⌃` / `Ctrl`             | Control        | Control            |
| `shift`                  | `⇧` / `Shift`            | Shift          | Shift              |
| `alt`, `option`          | `⌥` / `Alt`              | Option         | Alt                |
| `enter`, `return`        | `↵` / `Enter`            | Return         | Enter              |
| `backspace`              | `⌫` / `Backspace`        | Delete         | Backspace          |
| `delete`                 | `⌦` / `Del`              | Forward Delete | Delete             |
| `escape`, `esc`          | `⎋` / `Esc`              | Escape         | Escape             |
| `tab`                    | `⇥` / `Tab`              | Tab            | Tab                |
| `space`                  | `␣` / `Space`            | Space          | Space              |
| `up` … `right`           | `↑` … `→`                | Up Arrow …     | Up Arrow …         |
| `pageup`, `pagedown`     | `PgUp`, `PgDn`           | Page Up …      | Page Up …          |
| `home`, `end`            | `Home`, `End`            | = label        | = label            |
| anything else (`k`, `/`) | the key uppercased (`K`) | = label        | = label            |

The names are English, like the Win/Linux labels already were; `mlv-kbd` has
no i18n slice. On a Mac in another language the glyphs used to reach the
screen reader, which voiced them in its own language; now the English names
are voiced instead. Localizing them is a follow-up (an optional `MlvKbdI18n`
slice).

## 2. Before / after

| Surface                                                    | Before                                                                   | After                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| Host `aria-label`                                          | `⌘ + K` / `Ctrl + K`                                                     | **absent**                                  |
| `.mlv-kbd__key`                                            | exposed                                                                  | `aria-hidden="true"`                        |
| Text exposed in a sentence ("Press … to open.")            | caps `⌘`, `K` / `Ctrl`, `K` under a prohibited name `⌘ + K` / `Ctrl + K` | `Command + K` / `Control + K`               |
| Name of a `button` / `menuitem` / `link` containing it     | `Search ⌘ + K` / `Search Ctrl + K`                                       | `Search Command + K` / `Search Control + K` |
| axe `incomplete`                                           | `aria-prohibited-attr`                                                   | —                                           |
| `host.textContent`                                         | `Ctrl+K`                                                                 | `Control + KCtrl+K`                         |
| `host.innerText`                                           | `Ctrl\n+\nK`                                                             | `Control + K\nCtrl\n+\nK`                   |
| Copying "Press ⌘K to open." (caps are `user-select: none`) | `Press  to open.`                                                        | `Press Command + K to open.`                |

## 3. Who is affected

- **Specs or selectors reading the host label.** `mlv-kbd[aria-label="…"]`,
  `getAttribute('aria-label')` and `getByLabelText('Ctrl + K')` find nothing.
  **Do:** assert the spoken text through the visually hidden node
  (`kbd.querySelector('.cdk-visually-hidden')?.textContent`) or the accessible
  name of whatever contains it.
- **Specs reading the host's text.** `textContent` / `innerText` now start with
  the spoken text. **Do:** read the caps through `.mlv-kbd__key`.
- **Accessible-name locators on a control that contains a shortcut hint** —
  a button, a link, or an `<mlv-kbd mlvListItemSuffix>` inside an
  `mlvMenuItem`, which `MlvMenuItem`'s JSDoc suggests for a shortcut label.
  `getByRole('button', { name: 'Search Ctrl + K' })` no longer matches — the
  name is now `Search Control + K` (Win/Linux) or `Search Command + K` (macOS).
  **Do:** match the spoken form, or better, keep the hint out of the control's
  name: give the control its own `aria-label` (starting with its visible text,
  WCAG 2.5.3) and put the shortcut on it as `aria-keyshortcuts="Control+K"`.
- **Pages that load no `styles/malva-ui.css`.** The spoken text relies on the
  global `.cdk-visually-hidden` rule that sheet ships (as `mlv-label`'s
  required marker, `mlv-chat` and the toast live region already do). Without it
  the spoken text renders visibly. **Do:** include the stylesheet, or
  `@include cdk.a11y-visually-hidden()` from `@angular/cdk`.

Not affected: every `mlv-kbd` in `libs/` — there are none outside
`@malva-ui/core/kbd` itself (`mlv-menu` and `@malva-ui/editor` render no
shortcut hint) — and the 25 in `apps/docs`, none of which sits inside an
interactive element; they read by key name from this release with no edit.
