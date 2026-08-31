# Task 5 report — natural-language query filters

## Delivered

- Added `MlvFilter` query appearance with native removable sentence chips, accessible full text, and 18rem truncation.
- Added query appearance to `MlvSmartFilterBar`: optional search, wrapping filter chips, searchable Add filter popup, optional Clear all, and explicit-only Apply.
- Extended immutable filter execution payloads with an expression derived from the current flat filters.

## RED / GREEN

### RED

`yarn nx test core-filter --skipNxCache` initially failed seven new query-mode expectations: missing appearance support, query sentence/chip behavior, Add filter interaction, and execution expression payloads.

After adding expression immutability coverage, temporarily passing live filter state directly to the payload reproduced the expected shared-reference failure.

### GREEN

The final uncached core filter suite passes: 4 files, 72 tests.

## Interactions and compatibility

- `MlvFilter` keeps `appearance='field'` by default; its existing field markup and behavior remain unchanged.
- `MlvSmartFilterBar` keeps `appearance='classic'` by default; classic controls and execution semantics remain unchanged apart from the additive `expression` payload property.
- Query Add filter excludes disabled and already-visible definitions. Choosing one only reveals the field; it does not manufacture a condition or operand. The popup closes logically and focus moves to the newly visible filter trigger after render.
- Removing a query chip updates visibility and filter state. Live execution emits once for a valid resulting state; explicit mode waits for Apply.
- Clear all removes optional visibility and search/filter values while retaining required-field visibility. Existing required-field validation prevents an automatic execution until required values are valid.

## Accessibility

- Query chip removal has a field-specific accessible name, `Remove <field> filter`.
- Sentence text exposes its complete value through `title` and `aria-label`; only the visual text truncates.
- Popup options retain native buttons and keyboard focus behavior. Open query and Add filter popups are axe-clean in the core suite.

## Files

- `libs/core/filter/src/lib/filter/`
- `libs/core/filter/src/lib/smart-filter-bar/`
- `libs/core/filter/src/lib/filter.types.ts`
- `libs/core/filter/src/lib/filter.types.spec.ts`
- `.claude/projects/libs-filter.md`

## Verification

Passed:

- `yarn nx test core-filter --skipNxCache` — 72/72 tests
- `yarn nx lint core-filter --skipNxCache`
- `yarn nx typecheck core-filter --skipNxCache`
- `yarn nx run styles:check-padding-tokens --skipNxCache`
- `yarn nx typecheck core --skipNxCache`
- `yarn nx build core --skipNxCache`
- `yarn nx run docs:check-doc-api --skipNxCache`

`yarn tsc --noEmit -p libs/core/filter/tsconfig.spec.json` remains blocked by the two pre-existing nullable `search` references in `smart-filter-bar.spec.ts`; newly added nullable search usage is guarded.

## Concerns

- The core test runner emits known JSDOM CSS `@layer` parse warnings while tests pass.
- New query-only control labels are currently English literals. Existing operator and field labels continue to use the established i18n mechanism; adding locale-pack keys was kept out of this task's owned file scope and should be completed when translation ownership is available.

## Fix Round 1 — review follow-up

### Behavior and focus

- Newly added blank optional fields are query-removable without creating a synthetic condition. Required blank fields remain visible and do not present removal as an option; required valued fields use the localized clear label.
- Query chips now show only meaningful, required, or deliberately newly added blank fields. Default blank optional metadata does not become a permanent query chip.
- Query explicit mode suppresses automatic execution for structured edits, removal, and Clear all. The top-level Apply remains the execution boundary.
- Add filter focus waits for popup `afterClosed`, then uses `afterNextRender` to focus the new trigger; when metadata removes it during close, focus falls back to Add filter.

### i18n and accessibility

- Added localized Add filter, Remove `{label}` filter, Clear all, and No filters available entries to the i18n token, test fixture, and all 14 locale packs. The locale contract verifies both exact key coverage and no English fallback for these controls.
- The Add popup is now a native `ul`/`li` list of native buttons (no incomplete listbox roles), and its open state is axe-clean.
- Query triggers and removal controls use `--mlv-height-xs` (2rem); the grouped core build compiles the final SCSS.

### RED / GREEN evidence

- RED: uncached core-filter run failed the new blank-removal, native-popup-semantics, and explicit auto-execution regressions before implementation.
- GREEN: uncached core-filter passed 4 files / 77 tests; i18n locale suite passed 5 files / 104 tests, including all locale contracts.
