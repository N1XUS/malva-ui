# 2026-09 — a static `role` on `mlv-search-field` stays off the host

Applies to `@malva-ui/core/search-field` (`MlvSearchField`). Fixes #329 (audit
C035, finding OC-04).

**Breaking, behaviour only.** No exported symbol, selector, input, output,
model, injection token, BEM class or i18n key was renamed, removed or retyped.
`role` keeps its name, its `MlvSearchFieldRole` type and its `'searchbox'`
default, and the native `<input>` renders exactly the role it rendered before.
What moves is one attribute on the host: a **static** `role` written on
`<mlv-search-field>` no longer stays there.

Classified under `VERSIONING.md` § 3 row 112, _Changed default behaviour at an
unchanged API — … ARIA, what a value means_, not row 117. The host role was
never documented — the README, the JSDoc and the docs page all say the role
lands on the `<input>`, and that `'searchbox'` renders no `role` attribute — so
removing it restores the documented DOM. But it was observable: a
`[role="combobox"]` selector or test locator resolved to the host, and now
resolves to the input. The same split was ruled for the static host `id` in
`2026-09-checkbox-switch-consumer-id.md` (row 112) and for the dangling own
`for` in `2026-09-own-label-dangling-for.md`. On the `0.x` line a `!` commit is
demoted to a minor: `0.1.15` → `0.2.0` (§ 7).

## 1. What changed

`role` is an input. Angular hands a static template attribute to the matching
input **and** writes it to the element, so the README's documented
`<mlv-search-field role="combobox" …>` put `role="combobox"` on the inner
`<input>` (through `[role]="_resolvedRole()"` on `mlv-input`) and left a
literal `role="combobox"` on the host too. The host became a second combobox
wrapped around the real one — unnamed, with no `aria-expanded` and no
`aria-controls`, so axe raised `aria-required-attr` (critical) on it and a
screen reader announced an outer, unlabelled combobox. A static
`role="searchbox"` left an unnamed searchbox on the host
(`aria-input-field-name`). The unit suite drove `role` only through
`setInput`, which never writes the attribute, so it could not see either;
`apps/docs` search-field example 5 shipped the combobox shape.

The constructor now reads the static attribute through
`HostAttributeToken('role')` and removes it from the host with
`Renderer2.removeAttribute` — the shape `mlv-checkbox` / `mlv-switch` use for a
static `id`. The input value is unaffected: Angular sets initial inputs from the
template's attributes, not from the DOM. The strip runs on the server too, so
the pre-hydration payload carries the role once (`ssr-smoke.spec.ts`).

Not the constant `'[attr.role]': 'null'` host binding the issue proposed. That
binding wins the first change-detection pass against a consumer's own host
`[attr.role]` — a component's host bindings run after the parent template's
bindings on the same element — and removes it until that value next changes.
Measured with it in place: `<mlv-search-field [attr.role]="'search'">` rendered
no `role`, and a `createComponent(…, { hostElement })` host lost the `role` it
came with. `HostAttributeToken` sees only the template's static attributes, so
neither is touched.

Measured in jsdom (`search-field-host-role.spec.ts`); the first row also in
Chromium on docs example 5 before the change:

| Markup                                                                                                   | Before                                                                                | After                                              |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `<mlv-search-field role="combobox" ariaAutocomplete="list" [ariaControls]="id" [ariaExpanded]="open()">` | host `role="combobox"`, input `role="combobox"`; axe `aria-required-attr` on the host | host no `role`, input `role="combobox"`; axe clean |
| `<mlv-search-field role="searchbox" ariaLabel="Search orders">`                                          | host `role="searchbox"`, input no `role`; axe `aria-input-field-name` on the host     | no `role` on either; axe clean                     |
| `document.querySelector('[role="combobox"]')` over the first row                                         | the `<mlv-search-field>` host (first in tree order)                                   | the native `<input>`                               |
| `<mlv-search-field [role]="'combobox'">`                                                                 | host no `role`, input `role="combobox"`                                               | unchanged                                          |
| `<mlv-search-field [attr.role]="'search'">`                                                              | host `role="search"`                                                                  | unchanged                                          |
| `createComponent(MlvSearchField, { hostElement })`, host already `role="search"`                         | host keeps `role="search"`                                                            | unchanged                                          |

## 2. Who is affected, and what to do

Only templates that write `role` as a **static** attribute on
`<mlv-search-field>`. A bound `[role]` never reached the host. In the
repository that is docs example 5, which now renders one combobox; no
`mlv-search-field` in `libs/` sets a role, and none is composed with
`[mlvAutocomplete]` (which writes its role on the inner `<input>` and never on
the host).

**(a) A stylesheet selecting the host by role** — `mlv-search-field[role="combobox"]`,
or a global `[role="combobox"] { … }` rule that also caught the host. The first
matches nothing now; the second matches only the input.
**Do:** select the host by a class you add or by the BEM block
(`.mlv-search-field`).

**(b) A test or e2e locator that took the role as the host** —
`querySelector('[role="combobox"]')` returned the host first in tree order,
`getAllByRole('combobox')` returned two elements, and Playwright's strict
`getByRole('combobox')` resolved to two (so `.first()` picked the host). Each
now resolves the native `<input>` alone.
**Do:** locate by role and name (`getByRole('combobox', { name: 'Search commands' })`),
which is the input; for host classes go up with `input.closest('mlv-search-field')`.

**(c) Code reading the host's `role` attribute to learn the mode.** It is
`null` now.
**Do:** read the component's `role()` input, or the input's own `role`.

**(d) A static role outside `MlvSearchFieldRole`, in a template compiled
without `strictTemplates`** — `role="search"` for a landmark. Strict templates
reject it (TS2322: the attribute is the typed `role` input), but a non-strict
build fed `'search'` to the input and kept it on the host. It is stripped now,
like any static `role`.
**Do:** bind the host attribute instead: `[attr.role]="'search'"`, which is the
consumer's own and is left alone.

## 3. Not changed

- The `<input>`'s role, `navigate`, `commit` and every forwarded `aria-*`
  attribute behave exactly as before, static or bound.
- `aria-expanded` is still not defaulted for a combobox. A consumer who binds
  no `ariaExpanded` still gets `aria-required-attr` on the input, as the JSDoc
  says ("Required by the combobox pattern").
- `mlv-input` has the same shape — its own `role` input leaves a static `role`
  on its host as well as on its `<input>` — and is not part of this change
  (follow-up). `mlv-search-field` binds `mlv-input`'s `role`, so it never
  reaches that host.
