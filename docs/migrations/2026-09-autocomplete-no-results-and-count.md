# 2026-09 — `[mlvAutocomplete]` shows a no-results row and announces its result count

Applies to `@malva-ui/core/autocomplete` (`MlvAutocomplete`),
`@malva-ui/core/dropdown` (`MlvDropdownPanel`), `@malva-ui/i18n` and, through
`@malva-ui/core/date` (`MlvDateAdapter`), `@malva-ui/core/time-picker`
(`MlvTimePicker`). Fixes #370.

**Breaking: behaviour and ARIA, plus one type-level read case.** `loadingText()`
now reads `string | undefined`, so `const t: string = autocomplete.loadingText()`
fails with TS2322.

Nothing was renamed, removed or narrowed: no selector, input, output, model,
injection token, BEM class, `--mlv-*` token or i18n key. Every string moved into
`@malva-ui/i18n` renders byte-identical English (owner ruling D34). Two things
move:

- An open autocomplete with zero results now renders a visible row.
- An open autocomplete now announces its result count.

Before this change, the panel was blank and nothing was announced. The
library's own notes told consumers to project their own no-results copy.

Classified under `VERSIONING.md` § 3:

- **Row 112** (_Changed default behaviour at an unchanged API — … ARIA_) covers
  the "No results found" row and the polite `LiveAnnouncer` announcements. Both
  are new visible output and new screen-reader output at an unchanged API. The
  precedent is #334, where a newly named initials avatar was also row 112.
- **Row 115** (_New optional input; widened input type; new optional i18n key
  with a shipped default_) covers:
  - the new optional i18n keys and slices;
  - `loadingText` widening from `string` to `string | undefined` on
    `[mlvAutocomplete]` and `mlv-dropdown-panel`. This is a read widening, #348
    shape (f), which rides this `!`.
- **Row 114** (_New exported symbol / injection token / BEM modifier_) covers:
  - `MLV_AUTOCOMPLETE_I18N`, `MLV_DROPDOWN_PANEL_I18N` and their interfaces;
  - the concrete `MlvDateAdapter.getDayPeriodNames()`;
  - the `[mlvDropdownPanelEmpty]` content slot and `.mlv-dropdown-panel__empty`.

On the `0.x` line a `!` commit is demoted to a minor: `0.2.0` → `0.3.0` (§ 7).

## 1. What changed

| Situation (`[mlvAutocomplete]`, panel open)         | Before                                                    | After                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Zero results, nothing loading                       | Empty panel: a `role="listbox"` with no children, no text | A "No results found" row (`.mlv-dropdown-panel__empty`) **after** the listbox, outside it |
| Panel opens, or the result count changes            | Nothing announced                                         | `LiveAnnouncer.announce('3 results available', 'polite')` (`1 result available` for one)  |
| Count drops to zero                                 | Nothing announced                                         | `LiveAnnouncer.announce('No results found', 'polite')`                                    |
| Same count after another keystroke                  | —                                                         | No new announcement (the message is a `computed`)                                         |
| Remote search in flight (`[mlvAutocompleteSearch]`) | Loading row                                               | Loading row, and **no** announcement until the results land                               |
| Panel closed                                        | —                                                         | Nothing announced. The empty message between sessions re-arms the next open               |
| `loadingText` unset                                 | `'Loading…'` (the input default)                          | The pack's `autocomplete.loading`, else `'Loading…'` — identical in English               |
| `loadingText()` read type                           | `string`                                                  | `string \| undefined` (also on `MlvDropdownPanel`)                                        |

The wording comes from the new optional `autocomplete` slice of `MlvLanguage`:

- keys `noResults`, `loading` and `resultsAvailable`, the last an ICU plural on
  `{count}`;
- each shipped pack words the slice exactly as its own `combobox` slice, so a
  field reads the same whether it is `mlv-combobox` or `[mlvAutocomplete]`;
- a pack without the slice, or no `provideMlvI18n()` at all, renders and
  announces the English above;
- a language switch re-words an open panel's row and re-announces it.

Measured:

- **Before, against the base sources.** The reviewer ran the new
  `autocomplete-i18n.spec.ts` against base `autocomplete.ts`, and it failed on
  `expected null to be 'No results found'` and
  `expected undefined to be '3 results available | polite'`.
- **After.** The same spec passes: 14 tests, announcements read off a
  `LiveAnnouncer.announce` spy. Full axe sweeps of `document.body` pass with
  results, with the no-results row, and with the localized (`de`) row.
- **Why the row sits outside the listbox.** A text row inside an option-less
  `role="listbox"` fails axe `aria-required-children`. Projecting the row into
  the panel's default slot, which renders inside the listbox, turned four specs
  red: both no-results sweeps and both "row not inside the listbox" checks. The
  directive projects it into the new `[mlvDropdownPanelEmpty]` slot
  (`projectableNodes` `[[], [row]]`), which renders after the listbox.
- **Announcer behaviour** (`@angular/cdk` 22.1.8 `LiveAnnouncer`):
  - There is one live element per document, created by the root service's
    constructor. Since `[mlvAutocomplete]` injects the service eagerly, a
    server-rendered page with an autocomplete ships an empty
    `.cdk-live-announcer-element`, as pages with a toast, the editor or page
    route focus already do.
  - `announce()` clears any pending message and writes the new one after
    100 ms. So an autocomplete announcement made within 100 ms of another
    caller's replaces it. This is tracked for every caller in #592.

### Time-picker day periods (the adapter half)

The AM / PM buttons and the 12h trigger suffix of `mlv-time-picker` now come
from `MlvDateAdapter.getDayPeriodNames()`. That method reads the `Intl`
`dayPeriod` of the adapter locale, which follows `MLV_DATE_LOCALE`, then the
pack's `locale`, then `LOCALE_ID`.

`en` / `en-US` stay 'AM'/'PM'; other English locales follow Intl (en-GB, en-AU,
en-IN, en-IE, en-NZ → am/pm; en-CA → a.m./p.m.). Measured with Node 24 `Intl`,
which also gives en-ZA and en-SG "am" / "pm" and keeps en-PH at "AM" / "PM".
No shipped pack is affected: the `en` pack's locale is `en`.

The AM / PM column keeps the density token as its size and gains its content as
a floor (`inline-size: var(--mlv-tp-ampm-width); min-inline-size: max-content`,
was `width: var(--mlv-tp-ampm-width)`). A longer label such as `es` "a. m."
grows the column instead of being clipped, and a label that fits keeps the old
geometry, including the shrink the full-screen sheet needs.

Measured in Chrome 153 on the docs build (`/time-picker`, labels swapped in on
the live panel):

| State                                  | "AM" / "PM", before = after        | "a. m." / "p. m." before → after                                                          |
| -------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Anchored, tight → airy (example 2)     | column 48 / 52 / 56 / 64 / 72px    | tight, compact, comfortable clipped → 54 / 59 / 59px, none clipped; spacious and airy fit |
| Anchored, 12h with seconds (example 7) | drums 56, column 56, panel 252.9px | "p. m." clipped → column 59.2, panel 256.1px                                              |
| Sheet 375px, 12h with seconds          | drums 77.4, column 78.4px          | unchanged, none clipped                                                                   |
| Sheet 375px, 12h                       | drums and column 89.2px            | unchanged                                                                                 |
| Sheet 320px, 12h with seconds          | drums 65, column 66.5px            | unchanged, none clipped                                                                   |
| Sheet 320px, 12h                       | drums and column 80px              | unchanged                                                                                 |

English geometry is identical in every state. A floor of the token itself
(`min-inline-size: var(--mlv-tp-ampm-width)`) was measured and rejected: it
stopped the column shrinking in the sheet with seconds, moving width from the
drums into AM / PM (375px: drums 77.4 → 73.8, column 78.4 → 89.2px; 320px:
drums 65 → 60.5, column 66.5 → 80px).

## 2. Who is affected, and what to do

**(a) You render your own no-results row next to an `[mlvAutocomplete]`
field.** This was the pattern the old notes described. A zero-match query now
shows two messages: yours and the panel's.
**Do:** delete yours. To change the wording, set `autocomplete.noResults` in
your language pack (a hand-written pack, or a spread over a shipped one). There
is no per-field input for it.

**(b) You announce the count or "no results" yourself**, through your own
`LiveAnnouncer.announce(…)` or an `aria-live` region keyed to the result list.
Users now hear it twice. With the CDK announcer, whichever of the two calls
lands later within 100 ms replaces the other (see § 1).
**Do:** delete your announcement. Word it through `autocomplete.resultsAvailable`
(ICU `{count}`) and `autocomplete.noResults`.

**(c) Specs that expect a blank panel or silence.** Examples: a zero-match
query asserting the panel has no text, `announce` never called, or an exact
server-rendered HTML snapshot without the live element.
**Do:**

- Assert the row: `.mlv-dropdown-panel__empty` with text `No results found`.
  It is not a descendant of `[role="listbox"]`.
- Assert the announcer spy:
  `vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce')`, called with
  `('No results found', 'polite')` or `('3 results available', 'polite')`.
- In SSR snapshots, allow `.cdk-live-announcer-element`.

A full axe sweep of `document.body` stays clean.

**(d) TypeScript that reads `loadingText()`** off `MlvAutocomplete` or
`MlvDropdownPanel` into a `string` now fails with TS2322, because the read type
is `string | undefined`. Unset means "resolve through i18n". Binding
`[mlvAutocompleteLoadingText]` / `[loadingText]` is unchanged, and a bound value
still wins over the pack.
**Do:** write `loadingText() ?? ''`. If you need the text actually shown, read
it from the rendered loading row.

**(e) An app whose date locale is an English locale other than `en` / `en-US`.**
This means no pack locale plus an en-GB / en-AU / en-IN / en-IE / en-NZ (or
en-ZA / en-SG) `LOCALE_ID`, a pinned `MLV_DATE_LOCALE`, or a hand-written pack
whose `locale` is one of these. The time-picker there now reads "am" / "pm" on
its period buttons and trigger ("02:30 pm"), and "a.m." / "p.m." under en-CA.
Before, it showed "AM" / "PM" in every locale. The accessible name changes only
in case (and punctuation for en-CA).
**Do:** update visual and text snapshots. If you want "AM" / "PM" whatever the
locale, provide an `MLV_DATE_ADAPTER` subclass that overrides
`getDayPeriodNames()` to return `['AM', 'PM']`. Do not repin `MLV_DATE_LOCALE`
to `en-US` for this: that also changes every date the adapter formats.

## 3. Unchanged

- `mlv-combobox` and `mlv-select`. They bind their own `loadingText` and render
  their own no-results row as before. That row still sits inside the listbox,
  which fails `aria-required-children` on an opened empty combobox and is
  tracked as a follow-up. Moving it there is its own row-112 change.
- `mlv-dropdown-panel`'s default content slot, which still renders inside the
  listbox. `[mlvDropdownPanelEmpty]` is opt-in. A standalone panel with no
  `loadingText` shows the pack's `dropdownPanel.loading`, identical in English.
- Every `[mlvAutocomplete…]` input and output name, the matcher, the debounce,
  the keyboard model and the listbox markup around the options.
- The English text of every moved string: "Loading…", "No results found",
  "N results available" / "1 result available", "AM" / "PM" under `en` /
  `en-US`.

## 4. In-repo

- `apps/docs` autocomplete examples 1–4 now show the row and announce the
  count. Example 2's prose says the loading label comes from the pack and that
  `mlvAutocompleteLoadingText` overrides it.
- No library component and no docs page rendered its own no-results text or
  announcement beside `[mlvAutocomplete]`, so nothing doubles.
- Specs:
  - `autocomplete-i18n.spec.ts`: 14 tests, including a live `en` → `de` switch
    with the panel open.
  - `dropdown-panel-empty-slot.spec.ts`.
  - The no-results axe sweep in `autocomplete.spec.ts`.
  - `time-picker-i18n.spec.ts`, including a live `en` → `ja` switch
    (`02:30 PM` → `02:30 午後`).
  - `time-picker-styles.spec.ts` § _AM/PM column width_.
