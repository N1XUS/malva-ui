# Docs page: autocomplete

Route: `/autocomplete` → `AutocompletePageComponent` (`apps/docs/src/app/pages/autocomplete/index.ts`), registered in `apps/docs/src/app/app.routes.ts` and the **Forms** sidebar group in `apps/docs/src/app/app.ts` (icon `LucideListFilter`).

Demonstrates the `[mlvAutocomplete]` directive from `@malva-ui/core/autocomplete` applied to `mlv-input`.

## Examples

1. **Static options** (`examples/1`) — `[mlvAutocomplete]="fruits"` with local filtering, match highlighting, open-on-focus, and `(optionSelected)` writing the label back. The MDX also documents **inline completion** (on by default) and the `[mlvAutocompleteInline]="false"` opt-out.
2. **Async search** (`examples/2`) — `[mlvAutocompleteSearch]` returning an `Observable` with simulated 600ms latency, `minLength=2`, `debounce=250`, loading affordance, and stale-result cancellation.
3. **Custom matcher** (`examples/3`) — `[mlvAutocompleteMatcher]` supplying a prefix-only match instead of the default substring.
4. **Data-source suggestions** (`examples/4`) — `[mlvAutocomplete]` bound to an `MlvDataSource` (the shared docs demo source `apps/docs/src/app/pages/select/examples/8/remote-users.data-source.ts`, imported relatively): remote search through `setSearch({ query, keys: [] })`, previous results kept rendered while a newer query is in flight, and lazy paging on scroll through the panel's sentinel. Inline completion is opted out (`[mlvAutocompleteInline]="false"`) because a remote top match need not be a prefix of the typed text.

Keep this page and its examples aligned with the directive API documented in `.claude/projects/libs-autocomplete.md`.
