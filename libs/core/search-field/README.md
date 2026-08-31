# @malva-ui/core/search-field

`mlv-search-field` is a search-specific input that supports two commit
strategies while keeping one two-way bindable query model:

- `trigger="live"` emits deduplicated searches after a configurable trailing
  debounce (200 ms by default).
- `trigger="submit"` emits only when the user presses Enter or activates the
  submit button.
- Clearing always cancels pending work and updates `value` to an empty query;
  it also commits that query by default. Set `commitOnClear="false"` when a
  composite consumer owns commit orchestration.
- Disabled, loading, density, reduced-motion, keyboard, and translated-label
  states use the shared Malva UI primitives and conventions.

```html
<mlv-search-field trigger="live" [debounce]="250" [(value)]="query" (search)="loadResults($event)" />
```

Set `role="combobox"` to drive a consumer-owned suggestion listbox. The field
then stamps `role="combobox"` on its `<input>`, forwards `ariaControls` /
`ariaExpanded` / `ariaAutocomplete` / `ariaActiveDescendant` onto the same
element, and reports the option-navigation keys through `(navigate)`.
`(commit)` fires on Enter and the submit action; calling `preventDefault()` on
the event it carries takes the commit over, so Enter resolves the highlighted
option instead of emitting `search`.

```html
<mlv-search-field role="combobox" ariaAutocomplete="list" [value]="query()" [ariaControls]="listboxId" [ariaExpanded]="open()" [ariaActiveDescendant]="activeOptionId()" (valueChange)="onQueryChange($event)" (navigate)="onNavigate($event)" (commit)="onCommit($event)" (search)="loadResults($event)" />
```

Run `yarn nx test core-search-field` to execute the focused unit tests.
