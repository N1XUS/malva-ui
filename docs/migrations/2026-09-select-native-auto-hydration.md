# 2026-09 — a hydrating `mlv-select native="auto"` claims the server `<select>` before switching

**Packages:** `@malva-ui/core/select` (`MlvSelect`). Fixes #218.
**Kind:** breaking, **behaviour only**. No exported symbol was renamed or removed. No input, output, model, token, i18n key or BEM class changes; the `@malva-ui/core/select` barrel is unchanged.

---

## 1. What this touches

| Surface                                                           | Where it is observable                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `MlvSelect` with `native="auto"` under `provideClientHydration()` | the server payload, and a hydrating client's first render                                    |
| `openDropdown()`, `toggleDropdown()`                              | when called during that first render (e.g. from a parent's `ngAfterViewInit`)                |
| `labelTarget()` through `MlvFormControl` / `MLV_FORM_CONTROL`     | read during that first render (a projecting `mlv-form-field` reads it)                       |
| `.mlv-select--native`, the field label's `for`                    | present for that first render                                                                |
| the `id` **attribute** on `.mlv-select__trigger`                  | every native-mode trigger — server and browser, hydrating or not, `native="auto"` and `true` |

## 2. Why

`native="auto"` is documented as "the native `<select>` below `md`, the custom trigger above it". Under server rendering both halves disagreed, and hydration does not report it.

- **The server** has no viewport. CDK's `MediaMatcher` falls back to a no-op `matchMedia`, `MlvBreakpointService` stays on `'sm'`, and the server renders `.mlv-select--native`, a `<select id>` and `<label for>`.
- **A desktop client's first render** resolved the trigger from its real viewport. An `@if` branch mismatch is not a node-claiming error, so there was no NG0500 and nothing on the console or `ErrorHandler`. The trigger was built beside the unclaimed server `<select>`. Until `ApplicationRef.whenStable()` both carried the field's id and the dead `<select>` sat transparent over the live trigger. Then `cleanupDehydratedViews` removed it (`ngDevMode.dehydratedViewsRemoved` +1).
- **Every native-mode trigger** carried `id="null"`: `[id]="_nativeActive() ? null : id()"` was a property binding, and `element.id = null` stringifies.

Owner ruling: **the server stays native, and only hydration is gated.** A host hydration is claiming renders the native branch for its first render, then follows the viewport inside the same application tick. Every other browser render — a client-only app, a dialog, an `@if` that turns on after hydration, an `ngSkipHydration` subtree, a bootstrap without `provideClientHydration()` — resolves `'auto'` from the viewport from its first render, as before. `native="true"` / `"false"` are never gated.

"Being hydrated" has no public Angular API. The select reads the `ngh` attribute the server stamps on every serialised component host, in a field initializer: the client strips it in `renderComponent` → `retrieveHydrationInfo`, after the host's directives are constructed (verified against Angular 22.0.7). A tripwire spec fails if Angular stops stamping it or strips it earlier.

### Why this is `!` and not a patch

VERSIONING.md §3 "Bug fix that restores documented behaviour" covers the dead `<select>`, the duplicate id and `id="null"`. But inside that same first render the previous behaviour **did** deliver documented outcomes on a desktop, and some of them now arrive differently — "changed default behaviour at an unchanged API: ordering, timing, emitted events, focus, ARIA" is a major. `2026-09-popup-fullscreen-per-open.md` is the precedent for a narrow-window behaviour change shipped as `!`.

---

## 3. Before / after

Rows marked **hydrating desktop** apply only to a `native="auto"` select hydrated at or above `md`, during the bootstrap tick. After `ApplicationRef.whenStable()` it is on the custom trigger, exactly as before.

| Case                                                                                                                                                                                                       | Before                                                                                                                                               | After                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server payload, hidden trigger                                                                                                                                                                             | `id="null"`                                                                                                                                          | no `id` attribute                                                                                                                                                                                                                                                   |
| Server with `MlvBreakpointService` overridden to answer desktop                                                                                                                                            | custom trigger                                                                                                                                       | native `<select>` — the server renders `'auto'` native whatever its breakpoint service answers                                                                                                                                                                      |
| **Hydrating desktop**, first client render                                                                                                                                                                 | trigger built beside the unclaimed server `<select>`; two elements with the field's id; `dehydratedViewsRemoved` +1                                  | server `<select>` and trigger claimed (node identity kept), then switched to the trigger in the same tick; `dehydratedViewsRemoved` 0                                                                                                                               |
| **Hydrating desktop**, `labelTarget().labelable` during that render                                                                                                                                        | `false`                                                                                                                                              | `true`, then `false` in the same tick                                                                                                                                                                                                                               |
| **Hydrating desktop**, `.mlv-select--native` and the field label's `for` during that render                                                                                                                | absent                                                                                                                                               | present, then removed in the same tick (the label moves from `for` to `aria-labelledby`)                                                                                                                                                                            |
| **Hydrating desktop**, focus the user put on the server `<select>` before JavaScript ran                                                                                                                   | lost when the dead `<select>` was removed at stability                                                                                               | handed to the trigger; no `touch`; `focused()` stays `true`                                                                                                                                                                                                         |
| **Hydrating desktop**, a `cdkTrapFocusAutoCapture` region (or any later after-render hook) focusing the field in the bootstrap tick                                                                        | `cdkTrapFocusAutoCapture`: lands on the trigger; a hook focusing the `<select>` itself: lands on the dead server `<select>`, focus lost at stability | lands on the claimed `<select>` first (a `focus` event on it), then is handed to the trigger in the same tick; no `touch`; `focused()` `true`                                                                                                                       |
| **Hydrating desktop**, two selects whose `<select>`s are focused in turn in the bootstrap tick (before JavaScript, from a later after-render hook, or through `openDropdown()`)                            | hooks focusing the `<select>`s: the dead server `<select>`, focus lost at stability; `openDropdown()`: that select's trigger                         | the trigger of the select focused last; neither field touched; only that select reports `focused()`                                                                                                                                                                 |
| **Hydrating desktop**, `openDropdown()` during that render                                                                                                                                                 | focuses the trigger, `isOpen()` is `true` on return                                                                                                  | focuses the claimed `<select>`, `isOpen()` is `false` on return; once the switch lands, focus is on the trigger and the dropdown opens                                                                                                                              |
| **Hydrating desktop**, `toggleDropdown()` during that render                                                                                                                                               | `isOpen()` flips on return; focus untouched                                                                                                          | an open is recorded and applied once the switch lands; focus untouched. A toggle while an open is pending — two calls, or one from a hook before the switch lands — cancels it, and a toggle while `isOpen()` is already `true` closes it: same end state as before |
| **Hydrating desktop**, `native` turning `false` during that render after `openDropdown()` / `toggleDropdown()`                                                                                             | trigger focused (`openDropdown()` only), dropdown open                                                                                               | that render removes the claimed `<select>` (after `openDropdown()` it held focus, so Chromium fires `blur` on it); then focus is handed to the trigger, the dropdown opens, no `touch`, `focused()` `true`                                                          |
| **Any hydrating select** (`native="true"`, or `'auto'` below `md`), `native` turning `false` during its first render while the `<select>` holds focus (before JavaScript ran, or through `openDropdown()`) | focus lost when the `<select>` was removed: Chromium drops it to `<body>` and emits `touch`; jsdom fires no `blur`, so `focused()` stays `true`      | handed to the trigger, no `touch`, `focused()` `true` — the hand-off keys on "this render is hydrating and its `<select>` is going", not on the `'auto'` desktop switch                                                                                             |
| Client-rendered native-mode trigger (phone `'auto'`, any `native="true"`)                                                                                                                                  | `id="null"`                                                                                                                                          | no `id` attribute; the native `<select>` is the only element with the field's id                                                                                                                                                                                    |

Unchanged, and measured so:

- A hydrating **phone** (`'auto'` below `md`) and a hydrating `native="true"` render the same branch they always did, and a lazy `searchFn` runs at the same point in the tick — during the first render, before its after-render phase. The one change that reaches them is the focus hand-off in the second-to-last row above, and only when `native` turns `false` during that first render.
- A hydrating desktop still runs a lazy `searchFn` on its first open, or eagerly when a committed value needs its label. If `native` turns `true`, or the viewport answer drops below `md`, during that first render, the `<select>` stays and the load runs during that render, as before.
- `isOpen.set(true)` written directly during a hydrating desktop's first render: `isOpen()` is `true` on return and the dropdown is open, with one panel, after the bootstrap tick — before and after.

---

## 4. Who is affected

**Affected:**

- Apps using server rendering with `provideClientHydration()` and `native="auto"` hydrated at or above `md`, that act on the select **inside the bootstrap tick** — call `openDropdown()` / `toggleDropdown()` and read `isOpen()` synchronously, read `labelTarget()` during the first render, or listen for `focus` / `blur` on the `<select>` during bootstrap.
- CSS, e2e or unit tests that match `[id="null"]` or assert `trigger.id === 'null'` on a native-mode select — in any rendering mode.
- Servers that override `MlvBreakpointService` to answer a desktop viewport: their payload is now native, and the hydrating client switches after its first render.
- Apps that hydrate **any** select — `native="true"`, or `'auto'` below `md`, not only above it — and turn `native` `false` during that first render while the `<select>` has focus: the focus hand-off applies there too (the second-to-last row in § 3).

**Not affected:** client-only apps (apart from the trigger id), selects opened in a dialog, an `@if` that turns on after hydration, an `ngSkipHydration` subtree, a bootstrap without `provideClientHydration()`, and `native="false"`. Nothing in `libs/` or `apps/` hydrates a select or matches `id="null"`, so no in-repo markup changes.

---

## 5. What you have to do

Almost certainly nothing — after the bootstrap tick every select is where it was before. The mechanical edits, where one applies:

- **Acting on the select at bootstrap.** Read the outcome after `ApplicationRef.whenStable()`, not synchronously after the call. In a hydration spec:

  ```ts
  // before — true on return on a hydrating desktop, false now
  host.select().openDropdown();
  expect(host.select().isOpen()).toBe(true);

  // after
  host.select().openDropdown();
  await appRef.whenStable();
  expect(host.select().isOpen()).toBe(true);
  ```

- **Reading `labelTarget()`.** Read it after the first render; during a hydrating desktop's first render it describes the claimed `<select>`.
- **`id="null"` assertions.** Assert that the trigger carries no id:

  ```ts
  // before
  expect(trigger.id).toBe('null');
  // after
  expect(trigger.hasAttribute('id')).toBe(false);
  ```

- **A server-side desktop override of `MlvBreakpointService`** that was used to get the trigger into the payload: there is no replacement. `native="auto"` is native on the server by design, so a hydrating client's first render can claim it; use `native="false"` where the payload must carry the custom trigger.

---

## Known limits

Recorded so they are not mistaken for part of this change:

- **A later render removing a focused `<select>`** — a viewport crossing `md`, or `native` turning `false` — is unchanged: Chromium emits `touch` and drops focus to `<body>`; jsdom fires no `blur`, so `focused()` stays `true`. A desktop→phone crossing leaves focus on the trigger, which is then `aria-hidden` with `tabindex="-1"`.
- **A native choice made on the server `<select>` before JavaScript runs** is not verified against event replay (the trigger carries `jsaction="focus:;blur:;"`); `_syncNativeSelection` may write the committed value back onto the claimed options before a replayed `change` is read.
- **`@defer (hydrate on interaction)`** is unverified: jsdom has no event-dispatch contract. The interaction that triggers hydration lands on the `<select>` the switch removes, so an open native picker would close (expected, unmeasured).
- **`openDropdown()` followed by `isOpen.set(false)`** during a hydrating desktop's first render still opens once the switch lands (before: closed). A same-value write to `isOpen` cannot be told apart from no write, so the pending open cannot see it.
- **`openDropdown()` followed by `disabled` turning `true`** during that render ends closed: the pending open is skipped on an inert field (before: open on a disabled field).
- **A hook calling `blur()` on the focused claimed `<select>`** — only from a hook that runs **after** the select's own first after-render hook, not anywhere in that render: Chromium reports no `relatedTarget` for an explicit `blur()` (measured: Chrome 152), so the focus is still handed to the trigger (before: focus on `<body>`); jsdom reports the document and leaves focus on `<body>`. A `blur()` earlier in the render lands before the hand-off window exists and leaves focus on `<body>` in both engines, as before. Inferred from the measured events, not pinned.
- **The same server/client mismatch** exists, unfixed, in `mlv-sidebar` `effectiveMode`, `mlv-page-end-pane` `_compact` and `*mlvBreakpointDown` / `*mlvBreakpointUp`.
