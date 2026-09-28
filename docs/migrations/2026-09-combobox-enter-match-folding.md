# 2026-09 — `mlv-combobox` Enter matches typed text the way the list does

Applies to `@malva-ui/core/combobox` (`MlvCombobox`, `mlv-combobox`): Enter in
the search field with no highlighted option, with or without `allowCreate`,
and the empty state shown while nothing is listed (#350, audit C057 / OC-07).

**Breaking, behaviour only.** No exported symbol was added, renamed, removed or
retyped. The selector, every input, the `value` model, the `valueCreated`
output and its type, every i18n key and every BEM class are unchanged. What
changes is which option Enter selects, whether it creates a value and emits
`valueCreated`, and which empty-state text the panel shows and announces, for
text that differs from an existing entry only by case or by marks
`normalizeForMatch` strips. That is VERSIONING §3 row 112 (_default behaviour
— emitted events, what a value means_), not the issue's "not breaking", so it
ships with `!`, which on `0.x` releases as `0.2.0` → `0.3.0` (VERSIONING §7).
The half that makes `valueCreated`'s documented "never on duplicates" hold for
such a variant is row 117.

## 1. What changed

The list filters by `normalizeForMatch` (`@malva-ui/cdk/utils`). Enter did
not. Its "exact match" step compared `label.toLowerCase() ===
text.toLowerCase()`, and the `allowCreate` guard compared the raw text to the
selected **values** by `compareWith`. So:

- Typing `cafe` listed "Café", and Enter created a second value `cafe` and
  emitted `valueCreated` — or, without `allowCreate`, did nothing.
- A selected token "Café" or "New Tag" did not stop `cafe` or `new tag`; a
  tag input got two tags.
- A selected `{ label: 'Ukraine', value: 'UA' }` no longer listed (a remote
  source lists only the current query's results) did not stop `Ukraine`:
  `'Ukraine' !== 'UA'`. Two chips read "Ukraine".

Now one relation decides every check. A label **names** the typed text at one
of three ranks; the lowest rank wins, first in list order among equals:

1. **rank 0** — the same text, compared canonically (NFC): a decomposed label
   equals the precomposed text a keyboard types;
2. **rank 1** — the same text in another case: `toLowerCase()` equal, either
   as written (the comparison before this change, kept verbatim) or in NFC —
   both, because the two do not commute: typed `t` + U+0308 names a listed
   `T` + U+0308 only as written, since NFC composes the lower-case pair
   (U+1E97) and not the capital;
3. **rank 2** — the same `normalizeForMatch` fold, the key the list is filtered
   by, provided the fold is not empty.

Ranks 0 and 1 never consult the fold, so every label the old comparison named
is still named — including one made only of marks the fold strips (`^`,
`` ` ``, `´`, `¨`, `·` fold to `''`). Typing a label exactly never lands on a
different option.

| Check                         | Searched                                                                   | Result                                                                               |
| ----------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Select a listed option        | the rendered list (`filteredOptions()`)                                    | the option is selected, never deselected                                             |
| Create guard: selected values | the selected options' **labels**, then `isSelected(text)` by `compareWith` | no value created, no `valueCreated`; a single-select input shows its selection again |
| Create guard: listed options  | the select step above — a listed match never reaches creation              | —                                                                                    |
| Empty state and live region   | the create guard                                                           | "Press Enter to add" only when Enter would add; "No results found" otherwise         |

A created value is the trimmed text **as typed**, never its folded form.

### What the fold merges

`normalizeForMatch` decomposes (NFD), strips every character with Unicode
`Diacritic=Yes` and lower-cases. That is far more than Latin accents; it
includes:

- ASCII `^` and `` ` ``;
- kana voicing marks (dakuten, handakuten) and the prolonged sound mark `ー`
  (U+30FC);
- the breve that makes `й` from `и`;
- Indic viramas (Devanagari U+094D), Thai tone marks, Hebrew and Arabic
  vowel points.

So, measured in `combobox-enter-match.spec.ts`, Enter now selects a listed
`1.2.3` for `^1.2.3`, a listed `ピル` (pill) for `ビル` (building), a listed
`ハート` (heart) for `ハト` (pigeon) and a listed `мои` for `мой` — and, with
the mark on the label instead of the typed text, a listed `^1.2.3` for
`1.2.3`, a listed `` `code` `` for `code` and a listed `カー` (car) for `カ`
(mosquito). A selected token with any of those labels stops the other
spelling from being created. Before, each was created, or nothing happened
without `allowCreate`.
The list already showed each of those options for the other spelling; Enter
now treats what the list shows as a match. Whether Enter should use a narrower
key than the list is an open owner question; this change keeps the list's
key, as the issue prescribes.

## 2. Before / after

Measured in `combobox-enter-match.spec.ts` (typed through the native input,
Enter keydown; `allowCreate` on unless a row says otherwise).

| Options / selection                                          | Typed                   | Before                                 | After                             |
| ------------------------------------------------------------ | ----------------------- | -------------------------------------- | --------------------------------- |
| `['Café']`                                                   | `cafe`                  | value `'cafe'`, `valueCreated('cafe')` | value `'Café'`, no `valueCreated` |
| `['Café', 'Tea']`, no `allowCreate`                          | `cafe`                  | nothing                                | value `'Café'`                    |
| `['1.2.3']`, no `allowCreate`                                | `^1.2.3`                | nothing                                | value `'1.2.3'`                   |
| `['ピル']` / `['ハート']` / `['мои']`, no `allowCreate`      | `ビル` / `ハト` / `мой` | nothing                                | the listed option                 |
| `['^1.2.3']` / ``['`code`']`` / `['カー']`, no `allowCreate` | `1.2.3` / `code` / `カ` | nothing                                | the listed option                 |
| `['t', 'T' + U+0308]`, no `allowCreate`                      | `t` + U+0308            | `'T' + U+0308`                         | `'T' + U+0308` (unchanged)        |
| `['Resume', <Résumé decomposed, NFD>]`                       | `Résumé` (NFC)          | created `'Résumé'`                     | the decomposed option             |
| `['apple', 'Apple']`                                         | `Apple`                 | `'apple'` (first case-insensitive)     | `'Apple'`                         |
| `['+', { label: '^', value: 'pow' }]`                        | `^`                     | `'pow'`                                | `'pow'` (unchanged)               |
| `['+', { label: '^', value: 'pow' }]`                        | `` ` ``                 | created ``'`'``                        | created ``'`'`` (unchanged)       |
| multi, created `Café` selected                               | `cafe`                  | `['Café', 'cafe']`, emitted twice      | `['Café']`, emitted once          |
| multi, created `New Tag` selected                            | `new tag`               | `['New Tag', 'new tag']`               | `['New Tag']`                     |
| single, created `Café` selected                              | `CAFE`                  | `'CAFE'`, `valueCreated('CAFE')`       | `'Café'`, input reads "Café"      |
| multi, `'UA'` ("Ukraine") no longer listed                   | `Ukraine`               | `['UA', 'Ukraine']`                    | `['UA']`                          |
| multi, `'UA'` selected                                       | `UA`                    | `['UA']`, no `valueCreated`            | unchanged                         |
| `['Café']`                                                   | `caf`                   | created `'caf'`                        | created `'caf'` (unchanged)       |
| multi, `Café` selected, nothing listed                       | `cafe` / `Café`         | "Press Enter to add …"                 | "No results found"                |
| multi, `'UA'` selected, nothing listed                       | `UA`                    | "Press Enter to add "UA""              | "No results found"                |

Unchanged: a highlighted option still wins; an empty text still does nothing;
text that names nothing is created exactly as before, and "Press Enter to add"
still shows for it.

## 3. Who is affected

- **A `(valueCreated)` handler, or specs, expecting a case or diacritic variant
  of a listed option or a selected token to be created** — `cafe` beside
  "Café", `new tag` beside "New Tag". **Do:** nothing if the variant was a
  duplicate you meant to avoid. If the variants are genuinely distinct values
  (`año` / `ano`, `José` / `Jose`), there is no opt-out: Enter selects the
  existing one, and the variant cannot be created by typing. List both as
  options — among listed options the exact spelling wins — or create it from
  your own control.
- **Tokens that contain `^` or `` ` ``** — version ranges (`^1.2.3`),
  identifiers in backticks. Both directions merge: `^1.2.3` selects a listed
  `1.2.3`, `1.2.3` selects a listed `^1.2.3`, `code` selects a listed
  `` `code` ``, and a selected token stops the other spelling from being
  created. **Do:** list both spellings as options — the exact one wins at
  rank 0, so each selects itself. A custom `matcher` helps only if it keeps a
  label off the list whenever that label folds equal to the typed text but is
  spelled differently: Enter selects only what the list shows, but a substring
  matcher that merely keeps `^` and `` ` `` significant still lists `^1.2.3`
  for `1.2.3` (and `` `code` `` for `code`), and Enter then selects it. The
  guard against **selected** tokens always folds; there is no opt-out for it.
- **Non-Latin scripts** — Japanese (`ビル` / `ピル`, `ハト` / `ハート`,
  `カ` / `カー`), Cyrillic (`мой` / `мои`), Devanagari, Thai, Hebrew, Arabic.
  Words that differ only by a voicing mark, a prolonged mark, a breve, a
  virama, a tone mark or a vowel point are one entry to Enter, whichever
  word carries the mark: `ビル` selects a listed `ピル`, `カ` (mosquito) a
  listed `カー` (car). **Do:** as above — list every spelling you need
  selectable (the exact one wins), or supply a `matcher` that keeps
  fold-equal, differently spelled labels off the list; a substring matcher
  that only keeps the marks significant still lists `カー` for `カ`. A
  selected token still stops its folded twins from being created.
- **Specs asserting that Enter on `cafe` with "Café" listed does nothing
  without `allowCreate`.** **Do:** expect "Café" to be selected.
- **Lists holding several options that differ only in case.** Typing one
  exactly now selects that one, not the first case-insensitive match. **Do:**
  nothing, unless a spec pinned the old pick.
- **A single-select `allowCreate` combobox where re-typing the current value in
  another case replaced it** (`New Tag` → `new tag`). The selection is kept and
  the input shows it again. **Do:** clear it first (Escape twice, or the clear
  button), then type the new spelling.
- **Specs asserting "Press Enter to add …" for text that names a selected
  value** (an exact duplicate included). The panel and its live region now say
  "No results found" there, because Enter adds nothing. **Do:** expect
  `noResults`.

In this repository no markup changes. The only `allowCreate` usage, docs
combobox example 3, lists lower-case ASCII tags and appends each created tag
to its options, so typing a listed tag in another case already selected it;
what moves there is a diacritic or `^` variant of a listed or created tag
(`Frontënd`), which now selects that tag instead of adding a second one.
