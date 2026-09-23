# 2026-09 — A tooltip describes its host from init, beside the host's own description

Applies to `@malva-ui/core/tooltip` (`MlvTooltip`, `[mlvTooltip]`,
`MlvTooltipPanel`). Fixes #321 (audit OVERLAYS-02, consolidated item C027;
owner ruling D12).

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped; no barrel, selector, input, output, token, i18n key or BEM class
changed. `[mlvTooltip]`'s six inputs keep their names, types and defaults, and
`MlvTooltipPanel` keeps its five inputs. What moves is the **accessibility
tree**: which element describes the host, and from when.

The change has two halves, classified separately under `VERSIONING.md` § 3:

- **Row 112 — _Changed default behaviour at an unchanged API — … timing, …
  ARIA_ (major).** The host is described from its first render instead of
  `tooltipDelay` ms (default 300) after `focusin` / `mouseenter`, and stays
  described after the bubble hides (D12). The description now names a visually
  hidden element in CDK's `AriaDescriber` container on `<body>`, not the panel,
  and the panel is `aria-hidden="true"`. A host whose `aria-label` already
  equals the text gets no description at all. (The ticket cites row 111, which
  is _changed default value of an input_; no input default changed.)
- **Row 117 — _Bug fix that restores documented behaviour_ (patch).** The
  tooltip no longer **replaces** the host's own `aria-describedby` on show and
  **deletes** it on hide, and empty or whitespace-only text no longer shows an
  empty bubble with an arrow or describes the host by an empty element. (The
  ticket cites row 116, which is the deprecation row.)

They ship together as one `fix(tooltip)!`. On the `0.x` line a `!` commit is
demoted to a minor: `0.1.15` → `0.2.0` (§ 7; `docs/RELEASING.md` § 3.1).

A consumer whose specs do not read a tooltip host's `aria-describedby` or query
the panel by `role="tooltip"` through the accessibility tree, and who puts no
tooltip on a host whose `aria-describedby` changes (§ 2) or on a host whose
visible name the tooltip repeats, edits nothing.

## 1. What changed

`_show()` ran `setAttribute('aria-describedby', <panel id>)` and `_hide()` ran
`removeAttribute('aria-describedby')`. Three defects followed:

- **The host's own description was destroyed.** An input carrying
  `aria-describedby="pwd-rules"` and a tooltip lost `pwd-rules` on the first
  blur or hover and never got it back. In-repo this was live: the AI review bar's
  accept / reject buttons (`editor-ai-review-bar.html`) bind
  `[attr.aria-describedby]` to a hidden "Suggestion 1 of 2: replaces …"
  element, and one hover cost both buttons that description for the rest of
  the review — the binding's value never changes, so Angular never rewrote it.
- **A screen-reader user heard no description.** The id existed only while the
  lazily attached panel did, which starts `tooltipDelay` ms after `focusin`. A
  screen reader speaks the element at focus time; the description arrived
  300 ms later, unannounced.
- **Empty text still showed.** `[mlvTooltip]="''"` attached a pane with an
  empty bubble and its arrow, and described the host by an empty element.

Now a constructor `afterRenderEffect` registers the trimmed text with CDK's
root-provided `AriaDescriber` (`@angular/cdk/a11y`, already a dependency of
`@malva-ui/core`): it appends one `cdk-describedby-message-<APP_ID>-<n>` id to
whatever the host carries, removes only that id, and removes the attribute
when nothing is left. The text lives in one visually hidden `<div>` per
distinct string inside `.cdk-describedby-message-container` on `<body>`,
reference-counted across hosts. The effect re-runs when the text or
`tooltipDisabled` changes, its cleanup removing the previous id first, and
runs once more on destroy. `_show()` returns early on empty trimmed text; the
panel's host is `aria-hidden="true"`, since the text is already in the tree.

Measured in jsdom against `origin/main` @ `c622cce8` and after this change
(`tooltip.spec.ts` → _MlvTooltip — description_; host
`<span id="rules">At least 12 characters</span>` +
`<button aria-describedby="rules" mlvTooltip="Use a passphrase">`, ids
resolved to their text and joined with `|`):

| Situation                                                              | Before                                   | After                                                          |
| ---------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| First render, no hover or focus                                        | `At least 12 characters`                 | **`At least 12 characters \| Use a passphrase`**               |
| `focusin`, read with no wait                                           | `At least 12 characters`                 | **`At least 12 characters \| Use a passphrase`**               |
| Bubble shown                                                           | `Use a passphrase` (own id **replaced**) | `At least 12 characters \| Use a passphrase`                   |
| Bubble hidden again                                                    | attribute `null`                         | `At least 12 characters \| Use a passphrase`                   |
| Focus and blur inside `tooltipDelay` (never shown)                     | attribute `null` ¹                       | `At least 12 characters \| Use a passphrase`                   |
| Directive destroyed (`@if` off)                                        | attribute `null` ¹                       | exactly `rules`; the hidden element removed                    |
| Host with no own attribute, destroyed                                  | —                                        | attribute removed                                              |
| Text changed while hidden                                              | —                                        | new text only; the old element removed                         |
| `tooltipDisabled` toggled on / off                                     | own description only                     | description dropped / restored                                 |
| `[mlvTooltip]="''"` or `"   "`, hovered                                | 1 pane (empty bubble + arrow), described | **no pane, no id**                                             |
| `aria-label="Delete item"` + `mlvTooltip="Delete item"`, shown         | described by the panel (name read twice) | **no id** (`AriaDescriber` skips a text equal to `aria-label`) |
| Two hosts, same text; one destroyed                                    | —                                        | one shared hidden element, kept for the survivor               |
| Panel host `mlv-tooltip-panel`                                         | exposed, `role="tooltip"` inside         | **`aria-hidden="true"`**; `role="tooltip"` and its id kept     |
| AI review bar accept button, hover then leave                          | `mlv-tooltip-33`, then `null`            | `mlv-editor-ai-review-bar-description-1` throughout            |
| `rules` written by a co-hosted or own **host binding**, first render ² | `At least 12 characters`                 | `At least 12 characters \| Use a passphrase`                   |
| AI review bar _Stop generating_ (named by its text), shown             | described by the panel (name read twice) | **no tooltip**, no id (removed from the template)              |

¹ Read from the code rather than a spec: `_hide()` ran `removeAttribute` outside
its `if (this._overlayRef)` guard (`tooltip.ts:543` @ `c622cce8`), and every
`focusout`, every expired `mouseleave` grace period and the destroy hook call
`_hide()` — so the host's own description went on the first blur, shown or
not.

² A test-local directive, and a test-local component, whose host binding
writes `aria-describedby="rules"`; the shape of `mlv-radio-group` and
`fieldset[mlvFieldset]` with a message or description showing at init.

**Correction to the ticket's pin.** The issue expects `"hint"` **after hide**.
That is the old visibility-bound model; under D12 the description does not
depend on the bubble, so after hide the host still reads `"hint <id>"`.

## 2. Who is affected

- **Specs that read a tooltip host's `aria-describedby`.** A value matching
  `/^mlv-tooltip-/`, an attribute that is `null` until hover and after hide, or
  one that is **absent** on a host whose `aria-label` differs from the text —
  all change. In-repo, two `tooltip.spec.ts` specs and `hint.spec.ts` asserted
  the old contract and were updated (`mlv-hint`'s trigger is named by its text,
  so it now carries **no** `aria-describedby`).
- **Tests that find the bubble through the accessibility tree** —
  `getByRole('tooltip')` (Testing Library, Playwright) — no longer find it,
  because it sits under `aria-hidden`. A CSS query (`[role="tooltip"]`,
  `.mlv-tooltip`) still does; `speed-dial.spec.ts` counts `[role="tooltip"]`
  and is unchanged.
- **Hosts whose `aria-label` equals the tooltip text** — every
  `mlv-editor-command-button`, the editor zoom / link / table / image /
  more-formatting / AI-menu buttons, the AI review bar's previous / next /
  accept / reject icon buttons, the speed-dial actions, `mlv-hint`'s trigger,
  the colour-picker popup's swatch. They used to be described by the panel
  while it showed, so a screen reader said the name twice; now they carry no
  tooltip description. Their names are unchanged.
- **Hosts named by their content or by `aria-labelledby` whose tooltip repeats
  that name.** `AriaDescriber` compares the text against the `aria-label`
  **attribute** only — not `aria-labelledby`, text content or `title` — so
  such a host is now described by its own name from the first render, where
  before the repeat came only 300 ms into a show. In-repo there was one: the
  AI review bar's _Stop generating_ button, whose label is always visible
  (`white-space: nowrap`, never hidden). Its tooltip added nothing for sighted
  users either and is **removed** from the template; the icon-only review-bar
  buttons keep theirs.
- **Every other tooltip host** is now described permanently, from its first
  client render, and gains a `cdk-describedby-host` attribute while described.
  Selectors that match `[aria-describedby]` on those hosts now always match.
- **A tooltip on a host whose `aria-describedby` changes after the first
  render** — a consumer's changing `[attr.aria-describedby]`, and two library
  hosts that write it themselves: `mlv-radio-group` (its `description` /
  `message` ids, bound from the form-control base) and `fieldset[mlvFieldset]`
  (its `description` id). The tooltip's description is lost at the first
  change — see § 4.

Not affected: showing, hiding, delay, placement, tone, arrow, Escape (#319) and
the RTL offsets (#180); every host with no own `aria-describedby` other than
the added id.

## 3. What to do

| Shape                                                                        | Do                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A spec asserting `aria-describedby` matches `mlv-tooltip-*`                  | Resolve the id and assert its text: `document.getElementById(id)?.textContent` equals the tooltip text. The element is on `<body>`, not in the overlay container.                                                                                      |
| A spec asserting the attribute is `null` before hover or after hide          | Assert it is present from the first render and unchanged after hide — that timing is the D12 change.                                                                                                                                                   |
| A spec asserting a described host whose `aria-label` equals the tooltip text | Assert `hasAttribute('aria-describedby')` is `false`: the name already says it.                                                                                                                                                                        |
| `getByRole('tooltip')` to find the visible bubble                            | Query it by CSS — `document.querySelector('.mlv-tooltip')` — or assert the host's description instead, which is what assistive tech reads.                                                                                                             |
| `[attr.aria-describedby]` bound to a value that changes, on a tooltip host   | Write the attribute statically, or bind a value that does not change. Otherwise see § 4.                                                                                                                                                               |
| A tooltip on `mlv-radio-group` or `fieldset[mlvFieldset]`                    | The component writes the attribute itself, so the row above cannot be followed. Put help text in the component's own `description`, which stays referenced; a tooltip there loses its description at the first `message` / `description` change (§ 4). |
| A host named by its visible text or `aria-labelledby`, tooltip repeating it  | Drop the tooltip — it now describes the host by its own name. Keep tooltips for icon-only hosts, named by an `aria-label` equal to the text.                                                                                                           |
| Empty text used to suppress a tooltip (`cond ? '…' : ''`)                    | Nothing — it now shows nothing and describes nothing. `[tooltipDisabled]` still works and reads more clearly.                                                                                                                                          |

## 4. Mechanism notes

- **Why `afterRenderEffect`, not `effect`.** First, it runs after the whole
  render, so a **host binding on the same element** — a co-hosted directive's,
  or the host component's own (`mlv-radio-group`, `fieldset[mlvFieldset]`) —
  has been written before the id is appended. Angular writes an element's host
  bindings after the effects of the view the element sits in, so from a plain
  `effect()` the id was appended first and then overwritten by that binding on
  the first render, its hidden element leaked. A **template**
  `[attr.aria-describedby]` does not need it: the template is written before
  the view's effects either way (measured: under `effect()` it still ends
  `rules cdk-describedby-message-a-1-2`). The same order holds for the
  `aria-label` `AriaDescriber` compares against. `tooltip.spec.ts` → _lands
  beside an aria-describedby that … writes through a host binding at init_
  pins it for both shapes; ablating to `effect()` turns exactly those two red.
  Second, it never runs on the server. `AriaDescriber` ids carry a per-process counter and the client
  deletes the server's `[platform="server"]` container on its first
  `describe()`, so an id written during server rendering names nothing after
  hydration. Measured with a plain `effect()` in its place: a host with **no**
  own `aria-describedby` hydrated as
  `cdk-describedby-message-ng-1-3 cdk-describedby-message-ng-5-7`, the first
  dangling (`aria-valid-attr-value`). A host with a **static** own attribute
  hid it, because hydration re-applies the static attribute over the server's
  value. `tooltip-ssr.spec.ts` drives the real `renderApplication` →
  `provideClientHydration` round trip over both shapes; ablating
  `afterRenderEffect` to `effect` turns both of its specs red.
- **Server markup carries no description.** The server renders only the host's
  own `aria-describedby`; the hydrating client adds the id on its first render.
  A reader of the raw server HTML before hydration hears no tooltip text — the
  same as before this change, when the id appeared only on hover.
- **Limit — an `aria-describedby` rewritten after the first render.** Angular
  writes a bound attribute, template or host binding alike, verbatim, so a new
  value replaces the whole attribute and the tooltip's id is gone until the
  text or `tooltipDisabled` changes. The dropped text's hidden element also
  stays in the container after the host is destroyed, its reference never
  released — one leaked element per distinct text. Measured with a template
  binding (`ref`, text `Tip`): `a cdk-describedby-message-a-1-2` →
  `ref = 'b'` → `b` → text changed → `b cdk-describedby-message-a-1-3`;
  `ref = null` removes the attribute. Two **library** hosts write it
  themselves through a host binding, so no consumer binding is involved:
  - `mlv-radio-group` (`mlvTooltip="Pick one plan"`): init `Pick one plan` →
    `message="Required"` → `Required` → message cleared → no attribute →
    destroyed → the _Pick one plan_ element is still in
    `.cdk-describedby-message-container`.
  - `fieldset[mlvFieldset]` (`mlvTooltip="Fieldset hint"`): init
    `Fieldset hint` → `description` set → only the description.

  On those two, § 3's "write it statically" cannot be followed; the
  component's own `description` is the help text that stays referenced. Before
  this change the trade ran the other way: the tooltip overwrote the group's
  message reference on show and deleted it on hide. A **constant** binding —
  the AI review bar's — is written once, before the effect, and is safe; no
  in-repo template puts a tooltip on either library host. Angular Material's
  `MatTooltip` registers through the same `AriaDescriber` and shares the
  limit. Owed: a directive-level merge of the host's own references, which
  would need to observe the attribute (#529).

- **The `aria-label` comparison is a snapshot taken at registration.**
  `AriaDescriber` compares when `describe()` runs, and the effect re-runs only
  on the text or `tooltipDisabled`. So a host whose `aria-label` equals the
  text at registration and later changes while the text does not — a lazily
  translated or state-suffixed `[attr.aria-label]` — is **never** described
  (measured: `Delete` / `Delete` → label `Delete draft` → still no id), and a
  host whose label later changes to equal the text keeps its now-repeating
  description.
- **Only the `aria-label` attribute is compared.** Not `aria-labelledby`, text
  content or `title`: a host named any other way whose tooltip repeats its
  name is described by its own name. **Do:** drop the tooltip (§ 3). The AI
  review bar's _Stop generating_ button was the one in-repo instance and has
  lost its tooltip.
- **Registration waits for the host's view to be refreshed.** A view detached
  (`ChangeDetectorRef.detach()`) before its first change detection never
  describes its host (measured: no `aria-describedby`), while the bubble,
  attached imperatively from a host listener, still shows; inside
  `@defer (hydrate on …)` the description arrives when the block hydrates.
- **Content changes on a visible bubble** are #346's. The description already
  follows the text; #346 forwards content / tone / arrow to the attached panel
  and must not call `describe()` / `removeDescription()` itself.
- `mlv-tooltip-panel` keeps `role="tooltip"` and `[attr.id]="tooltipId()"`
  inside the hidden subtree, so CSS and DOM hooks keep working; nothing
  references the id.
