# 2026-09 — a projected `mlv-divider` label names the separator

Applies to `@malva-ui/core/divider` (`MlvDivider`, `mlv-divider`). Fixes #332
(audit C039, finding H-13).

**Breaking — behaviour, and the type of one existing binding.** No exported
symbol, selector, input, output, injection token, `--mlv-*` token, i18n key or
BEM class was renamed or removed. `orientation`, `dashed` and `muted` keep
their names, types and defaults, and the host keeps `role="separator"` and
`aria-orientation`. Added: one BEM element, `.mlv-divider__label` (row 114),
and one optional input, `ariaLabelledBy` (row 115; `[ariaLabelledBy]` did not
compile before, NG8002). `ariaLabel` is declared as an input as well, but
`[ariaLabel]` is **not** a new binding: Angular's DOM schema lists the
`ariaLabel` property on every element, so it already compiled, unchecked, and
named the divider through ARIA reflection on the client. The input captures
that binding and types it `string | null | undefined` — see (g). What moves is
the separator's accessible name: projected content now names it.

Classified under `VERSIONING.md` § 3 row 112, _Changed default behaviour at an
unchanged API — … ARIA_, plus row 109, _Narrowed type of an input_, for
`[ariaLabel]`: any value compiled before, a non-string now fails TS2322. Not
row 117: nothing documented the name — the class
JSDoc claimed an `<hr role="separator">` was rendered, which was false and is
corrected here. The issue called its `aria-label` option non-breaking; the
repository classes an accessible-name change at an unchanged API as row 112
(`2026-09-progress-label-slot.md`, `2026-09-popup-fullscreen-dialog-semantics.md`),
whatever attribute carries it. On the `0.x` line a `!` commit is demoted to a
minor: `0.2.0` → `0.3.0` (§ 7).

## 1. What changed

`<mlv-divider>OR</mlv-divider>` (docs example 3) reached no assistive
technology. `role="separator"` takes its name from the author only and its
children are presentational, and both engines act on that for a text label:
Chromium exposes a separator to platform accessibility APIs as a leaf
(`AXNode::IsLeaf` lists `kSplitter`), Firefox prunes a separator whose only
child is a text leaf (`nsAccUtils::MustPrune` lists `SEPARATOR`). The "OR" was
in Chromium's internal tree as a StaticText child, and the platform API dropped
it. Firefox does expose content of **more than one node** as children — the
`<strong>` of `Today, <strong>12 May</strong>`, a projected `<button>` as
`button "more"` (measured, Firefox 146) — but never as the separator's name. No
axe rule asks a separator for a name, so the existing sweep stayed green.

The template now wraps the one `<ng-content />` in
`<span class="mlv-divider__label" aria-hidden="true">` and the host points
`aria-labelledby` at it:

- **`aria-labelledby`, not a mirrored `aria-label`.** Mirroring the text means
  reading `textContent` after every render for every divider on the page, and a
  host `[attr.aria-label]` binding would overwrite a consumer's own
  `aria-label`. A reference is followed by the browser: a label that arrives,
  changes or empties later needs no script.
- **The wrapper is `aria-hidden`.** `aria-labelledby` still reads a hidden node
  it references directly (accname step 2A). Left visible, Chromium's tree
  carries the text twice — as the name and as a StaticText child (measured) —
  and Firefox exposes a multi-node label's nodes as children (measured on
  `main`'s markup). Hiding the wrapper keeps the text out of the tree in both
  engines, so it is announced once, as the name.
- **Emitted on bare dividers too.** An empty reference yields no name and
  accname falls through to `aria-label`, so a bare divider stays unnamed.
- **A consumer's static naming wins.** Read through `HostAttributeToken`: a
  static `aria-labelledby` is written back as-is instead of the wrapper id; a
  static `aria-label` suppresses the divider's `aria-labelledby` (accname would
  rank the reference first). Neither allocates a wrapper id. This is the rule
  `mlv-progress`, `mlv-drawer` and `mlv-dialog` follow for a name generated
  from DOM text.
- **A bound name goes through an input.** The token sees static attributes
  only, and the host binds `aria-labelledby` itself, so `[ariaLabel]` /
  `[ariaLabelledBy]` carry a translated string or a per-row id; see (d).
  `[ariaLabel]` named the divider before too, as a DOM-property binding the
  browser reflected to `aria-label` on the client only; as an input it is
  type-checked and in the server payload, see (g). A static attribute does not
  feed the input of the same name (`aria-label` is not `ariaLabel`, measured),
  which is why the token is still read.
  `ariaLabelledBy` outranks everything; `ariaLabel` wins over the label.
  `ariaLabel` is written by an `effect()`, not a host binding — a host
  `[attr.aria-label]` writes `null` on the first render and wins that render's
  tie against a consumer's own `[attr.aria-label]`, which would unname a bare
  divider named that way (measured with the binding swapped in).
- **The role stays.** Dropping `role="separator"` whenever content is projected
  (the issue's rejected alternative) loses the separator for AT users who
  navigate by it, and `aria-orientation` on the role-less host would be an axe
  `aria-allowed-attr` violation.

Measured natively — Chromium 145 `Accessibility.getFullAXTree` (CDP), Firefox
146 WebDriver BiDi `browsingContext.locateNodes` with an `accessibility`
locator, which resolves through Firefox's own accessibility service. "Before"
is the exact host markup `main` renders; "after" is the built docs app's
`/divider` route, and for the input and bound-attribute rows the markup the
component renders in its spec, first render. A Firefox cell reads "this name
located the separator" — the locator matches by name, so a `""` there means no
queried name located it.

| Markup                                                       | Before (Chromium · Firefox)                                                  | After (Chromium · Firefox)                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `<mlv-divider>OR</mlv-divider>`                              | separator, name `""` (StaticText "OR" child the platform API drops) · `""`   | separator named "OR" · "OR"                                                    |
| `<mlv-divider>Continue below</mlv-divider>`                  | `""` · `""`                                                                  | "Continue below" · "Continue below"                                            |
| `<mlv-divider orientation="vertical">or</mlv-divider>`       | `""` · `""`                                                                  | "or" · "or"                                                                    |
| `<mlv-divider />`                                            | `""` · `""`                                                                  | `""` · `""` (reference to an empty node)                                       |
| `<mlv-divider aria-label="Section break" />`                 | "Section break" · "Section break"                                            | unchanged                                                                      |
| `<mlv-divider aria-label="Sign-in options">OR</mlv-divider>` | "Sign-in options" · "Sign-in options"                                        | unchanged — no `aria-labelledby` emitted                                       |
| `<mlv-divider aria-labelledby="x">OR</mlv-divider>`          | "Payment methods" (`x`'s text) · same                                        | unchanged — the value is written back                                          |
| `<mlv-divider [ariaLabel]="t()">OR</mlv-divider>`            | `t()`'s text · same (DOM property `ariaLabel`, ARIA reflection, client-side) | `t()`'s text · same, server-rendered too; follows it, cleared → "OR" — see (g) |
| `<mlv-divider [ariaLabelledBy]="'h-' + row">` in `@for`      | — (did not compile, NG8002)                                                  | each row's heading text · same                                                 |
| `<mlv-divider [attr.aria-label]="t()" />`                    | `t()`'s text · same                                                          | unchanged (the empty reference falls through to it)                            |
| `<mlv-divider [attr.aria-label]="t()">OR</mlv-divider>`      | `t()`'s text · same                                                          | "OR" · "OR" — see (d)                                                          |
| `<mlv-divider [attr.aria-labelledby]="ref()">…`              | `ref()`'s text · same                                                        | "OR" labelled, `""` bare, until `ref()` changes — see (d)                      |

Geometry, measured in Chromium against each version's compiled stylesheet, LTR
and RTL: identical for a bare horizontal or vertical divider, a text label, a
long label, a comment-only or zero-length-text slot (an `@if` anchor, an empty
interpolation) and a vertical label. The label's spacing moved from a host
`gap` keyed on `:not(:empty)` — which can no longer match, because the wrapper
is always rendered — to `margin-inline` / `margin-block` on
`.mlv-divider__label:not(:empty)`, at the same 0.5rem / 0.25rem
(`--mlv-spacing-2` / `--mlv-spacing-1`). The one layout that moves is a label
made of **several nodes** — see (c). An edge case also moves: whitespace-only
projected text (`{{ ' ' }}`, or a newline under `preserveWhitespaces`) matches
`:not(:empty)` in Chromium 145, so the empty-looking label takes both margins
and the gap between the segments doubles — 8px → 16px horizontal, 4px → 8px
vertical, the same in RTL.

## 2. Who is affected, and what to do

Only dividers with projected content, plus the few consumer shapes below. The
repository has two labelled dividers (docs example 3) and the SSR smoke host;
every other `mlv-divider` in `libs/` and `apps/docs` is bare and gains only an
`aria-labelledby` to an empty wrapper. None binds a naming attribute.

**(a) Tests or ARIA snapshots over a labelled divider.** The separator now has
a name: `getByRole('separator', { name: 'OR' })` matches, and an accessibility
snapshot of the separator gains `name: "OR"`.
**Do:** update the snapshot; `getByRole('separator')` without a name still
matches.

**(b) CSS or queries on the host's children or emptiness** —
`mlv-divider > strong`, `mlv-divider:empty { … }`, `mlv-divider:not(:empty)`.
Projected nodes are now children of the wrapper, and the host is never
`:empty`.
**Do:** target `.mlv-divider__label` (`.mlv-divider__label > strong`,
`.mlv-divider__label:empty`). `textContent` of the host is unchanged.

**(c) A label made of several nodes** — `<svg lucideCalendar /> Today`,
`Today, <strong>12 May</strong>`. Each projected node used to be its own flex
item with the 0.5rem gap between every pair (measured: an icon, text and a
`<strong>` spanned 9.25px more than they do now); they now flow as one inline run with
ordinary word spacing.
**Do:** put a `margin-inline-end` on the icon if you want the old gap.

**(d) A name bound on the attribute** — `[attr.aria-label]` (or Angular's
`[aria-label]`) and `[attr.aria-labelledby]`. `HostAttributeToken` sees only
static attributes, so neither is recognised as the consumer's name:

- `[attr.aria-label]` still names a **bare** divider, but on a divider with a
  label the label now wins (accname ranks `aria-labelledby` first) — an i18n
  "Sign-in options" around "OR" is announced "OR".
- `[attr.aria-labelledby]` competes with the host's own `aria-labelledby`
  binding, and a host binding wins the first render's tie: the consumer's value
  is overwritten, lands only once it changes, and a constant one — a per-row id
  in `@for` — never lands. A labelled divider is then named by its label, a
  bare one is unnamed.

**Do:** bind the inputs instead — `[ariaLabel]="t('signInOptions')"`,
`[ariaLabelledBy]="'heading-' + row.id"`. A fixed name can also stay a static
attribute (`aria-label="…"`, `aria-labelledby="…"`), which is kept as before.
Do not combine `[attr.aria-label]` and `[ariaLabel]` on one divider: clearing
`ariaLabel` removes the attribute, the bound `[attr.aria-label]` included,
until that binding's value changes.

**(e) Interactive content inside a divider** — a "Show more" button or a link.
Chromium never exposed a separator's children, so there it was already
unannounced. Firefox exposed any content of more than one node, focusable
controls included — `Show <button>more</button>` gave a reachable
`button "more"`. Inside the `aria-hidden` wrapper that content is now hidden in
**both** engines while the control stays focusable: for Firefox users a
regression — a working control becomes a focus stop that announces nothing
(WCAG 4.1.2) — and an axe `aria-hidden-focus` violation everywhere.
**Do:** move the control out of the divider and place it beside one.

**(f) Snapshots of generated ids.** Every self-labelled divider takes one
number from the shared `mlvNextId()` counter, so ids generated after it in the
same process (`mlv-control-<n>`, `mlv-tooltip-<n>`, …) shift. A divider named
by a static `aria-label` / `aria-labelledby` takes none; one named only through
`ariaLabel` / `ariaLabelledBy` still takes one, since those can be cleared.
**Do:** assert ids by relation (`aria-labelledby` resolves to …), not by value.

**(g) `[ariaLabel]` bound on a divider.** Before this change it compiled as an
unchecked DOM-property binding — Angular's DOM schema lists `ariaLabel` on
every element — and the browser reflected it to `aria-label`, on the client
only. The new `ariaLabel` input captures that binding:

- It is type-checked as `string | null | undefined`: a number or any other
  non-string (`[ariaLabel]="count"`) now fails TS2322 under strict templates
  (row 109).
- A `null` / `undefined` value now **restores** a static `aria-label` on the
  same element; reflection removed it.
- A string names the divider as before on the client, and is now also in the
  server payload.

**Do:** pass a string — `[ariaLabel]="String(count)"`, or better a formatted
label. To drop a static `aria-label`, delete it from the template instead of
binding `null` over it.

## 3. Not changed

- `role="separator"`, `aria-orientation`, the three existing inputs and every
  existing BEM class and modifier.
- The rendering of a bare divider and of a plain-text label, in both
  orientations and both directions.
- No script reads the DOM at runtime: the name is a static reference, and the
  server payload already carries it, as it does an `ariaLabel` name
  (`ssr-smoke.spec.ts`).
- A `createComponent(…, { hostElement })` root host: `HostAttributeToken` is
  always `null` there, so the `aria-label` / `aria-labelledby` the host element
  came with is not read and a projected label wins over it, as a bound
  attribute does. Pass the name through `setInput('ariaLabel', …)` or
  `setInput('ariaLabelledBy', …)`.
