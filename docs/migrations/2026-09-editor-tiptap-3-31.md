# `@malva-ui/editor` requires Tiptap 3.31

Date: 2026-09-23. Issue: [#291](https://github.com/N1XUS/malva-ui/issues/291).

Applies to **`@malva-ui/editor` only**: its twelve `@tiptap/*` peers and two
new ProseMirror peers. Every `@tiptap/*` peer moves from `^3.29.0` to
`^3.31.0`, and the editor now declares `prosemirror-view: ^1.42.5` and
`prosemirror-model: ^1.25.12`. Together they clear three published security
advisories against the old floor.

- **Why it is breaking:** it **narrows published peer ranges** and adds two
  required peers. [VERSIONING.md](../../VERSIONING.md) §2 #8 makes
  `peerDependencies` public API, and §3 treats a narrowed peer range as a
  major. A consumer still on Tiptap 3.29 or 3.30, or pinning an older
  `prosemirror-view` / `prosemirror-model`, gets `ERESOLVE` from npm 7+.
- **No exported symbol was renamed or removed.** No selector, input, output,
  token, BEM class or i18n key changed either.
- **Behaviour does change.** Tiptap changes some behaviour between 3.29.2 and
  3.31.3, and the editor inherits it. Each change that reaches the editor is in
  the [behaviour table](#behaviour-329--331) and has a test in the workspace.

## Before / after

### Peer ranges (`@malva-ui/editor`'s `peerDependencies`)

| Package                          | Before                                           | After          |
| -------------------------------- | ------------------------------------------------ | -------------- |
| `@tiptap/core`                   | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/pm`                     | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/starter-kit`            | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/extensions`             | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/markdown`               | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/extension-file-handler` | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/extension-highlight`    | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/extension-image`        | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/extension-list`         | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/extension-table`        | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/extension-text-align`   | `^3.29.0`                                        | `^3.31.0`      |
| `@tiptap/extension-text-style`   | `^3.29.0`                                        | `^3.31.0`      |
| `prosemirror-view`               | not a peer (`@tiptap/pm` 3.29.2 asks `^1.41.9`)  | **`^1.42.5`**  |
| `prosemirror-model`              | not a peer (`@tiptap/pm` 3.29.2 asks `^1.25.11`) | **`^1.25.12`** |

The two ProseMirror ranges are written by hand. They are security floors, not
derived from a root pin, so `widen-peer-range.mjs` leaves them alone and they
publish verbatim. **Raising either floor later is a Malva major**, like any
narrowed peer range.

The view floor is **1.42.5**, not the advisory's fixed version 1.42.3, because
1.42.5 is the first `prosemirror-view` release that pairs with `prosemirror-model` ≥ 1.25.12:

- Views 1.42.3 and 1.42.4 guard the pasted context with `checkAttrs` and then
  call `type.create()` outside that `try`.
- Model 1.25.12 turned `checkAttrs` into a no-op and validates inside
  `create()` instead.
- So view 1.42.3–1.42.4 with model ≥ 1.25.12 throws a `RangeError` out of the
  paste handler on an invalid context attribute. The browser then pastes
  natively, instead of the view dropping the wrapper. It is not an XSS, but it
  is a broken paste. 1.42.5 moved `create()` inside the `try`, and itself
  requires model `^1.25.12`.
- Do not lower the view floor back to 1.42.3.

### What `npm ls prosemirror-view prosemirror-model` must show

| Package             | Required                | Why                                                                                                                                            |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `prosemirror-view`  | **one copy, ≥ 1.42.5**  | the paste fix lives here, and 1.42.5 is the first view that pairs with model ≥ 1.25.12; `@tiptap/pm` 3.31.x asks less, so the peer enforces it |
| `prosemirror-model` | **one copy, ≥ 1.25.12** | view ≥ 1.42.5 relies on model ≥ 1.25.12 to validate; a second, older copy silently turns the fix off                                           |

### Behaviour (3.29 → 3.31)

| Behaviour                                                                     | 3.29                                                                   | 3.31                                                                                    |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Markdown value with unclosed inline HTML (`Hello <b>world`)                   | invalid document; `MlvEditor` reverts the value, emits a `parse` error | tag dropped, text kept; no error                                                        |
| Serialized Markdown: block nested under an ordered item                       | indented two spaces (other tools read a sibling list)                  | indented to the marker width (`1. ` → three spaces); bullets unchanged                  |
| Serialized Markdown: whitespace-only marked text                              | `a**** b`                                                              | `a b`                                                                                   |
| Markdown `$$` line after an ordered item                                      | folded into the item's text                                            | ends the item; a literal paragraph after the list                                       |
| Tab at the start of a paragraph directly after a bullet / ordered / task list | falls through; focus leaves the editor                                 | consumed; the paragraph sinks into the list's last item                                 |
| Backspace at the start of a list item's second paragraph                      | lifts the whole item out of the list                                   | joins it to the first paragraph (`<li><p>firstsecond</p></li>`)                         |
| Backspace that merges a paragraph into a blockquote                           | caret at the join point                                                | caret after the merged text                                                             |
| Unset colour inside a blockquote, list item or table cell                     | strips every colour in the container                                   | keeps the colour of text outside the selection                                          |
| Delete the last table row or column                                           | selection jumps to the block below                                     | selection stays inside the table                                                        |
| Resizable image whose source fails to load                                    | stays `visibility: hidden`, pointer events off                         | revealed                                                                                |
| Task item checkbox name                                                       | IDL `ariaLabel` property only; empty `<label>`                         | `aria-label` attribute, plus a visually hidden `<span>` with the same text in the label |

## Who is affected

- **Every consumer: the install.** Raise all twelve `@tiptap/*` peers together
  and install or verify the two ProseMirror peers (see
  [What consumers change](#what-consumers-change)).
  - npm 7+ installs missing peers itself, and refuses an unmet one with
    `ERESOLVE`.
  - Yarn Berry installs no peers. pnpm 8+ installs missing peers by default.
    Both only warn on an unmet peer, not error, so on those add both
    ProseMirror packages to your own dependencies.
- **Consumers with custom extensions whose node attributes declare
  `validate`.** Passed through the documented `extensions` input. These are the
  editors GHSA-c8x8 actually reaches, since the paste fix is enforced only on
  validated attributes.
  - Protected when the install resolves `prosemirror-view` ≥ 1.42.5 **and**
    a single `prosemirror-model` ≥ 1.25.12, the pair the peers require. (View
    1.42.3–1.42.4 with a single model ≤ 1.25.11 also validates; mixing 1.42.3–1.42.4
    with model ≥ 1.25.12 throws on paste instead.)
  - Check both with `npm ls`. A peer declares a floor; it does not dedupe a
    lockfile. A Yarn Berry or pnpm lockfile that already held model 1.25.11
    can keep it beside 1.25.12. The schema is then built from the old copy and
    the fix is silently off. The workspace itself hit this before deduping.
- **Consumers with custom extensions built on `createBlockMarkdownSpec`,
  `createAtomBlockMarkdownSpec` or `createInlineMarkdownSpec`.** These are the
  editors GHSA-j95f reaches. 3.30.5 or later fixes it; nothing else to do.
- **Consumers who store Markdown** (`format="markdown"`) and diff or
  round-trip it. The serialized bytes change (rows 2–4 above), and a value that
  used to fail with a `parse` error now loads (row 1).
- **Consumers with selectors, snapshots or tests** on the task item label, Tab,
  Backspace, caret position, colour removal or table deletion (rows 5–11).

## Who is not affected

- **Default preset only** (`mlvEditorDefaultExtensions()`, no custom
  extensions), in any format.
  - No attribute in the preset declares `validate`, so GHSA-c8x8 has nothing
    to enforce.
  - No preset extension uses the GHSA-j95f helpers.
  - GHSA-cp6q (`mergeAttributes`) does apply, and the install alone fixes it.
  - The behaviour rows still apply, but no code change is needed.
- **Anything outside `@malva-ui/editor`.** `@malva-ui/core`, `scheduler`,
  `taskboard` and `i18n` import no Tiptap.

## What consumers change

```bash
npm i @tiptap/core@^3.31 @tiptap/pm@^3.31 @tiptap/starter-kit@^3.31 \
  @tiptap/extensions@^3.31 @tiptap/markdown@^3.31 \
  @tiptap/extension-file-handler@^3.31 @tiptap/extension-highlight@^3.31 \
  @tiptap/extension-image@^3.31 @tiptap/extension-list@^3.31 \
  @tiptap/extension-table@^3.31 @tiptap/extension-text-align@^3.31 \
  @tiptap/extension-text-style@^3.31 \
  prosemirror-view@^1.42.5 prosemirror-model@^1.25.12
```

Then check the ProseMirror copies the install actually resolved. It must show
**one copy of each, at or above the floor**:

```bash
npm ls prosemirror-view prosemirror-model
```

- **You need `prosemirror-view` ≥ 1.42.5.** The paste XSS fix lives there, not in
  Tiptap: it arrived in 1.42.3, and 1.42.5 is the first view release that pairs
  with `prosemirror-model` ≥ 1.25.12 (see [Before / after](#before--after)).
  - `^3.31.0` admits `@tiptap/pm` 3.31.0 and 3.31.1. Neither requires the fixed
    view; only 3.31.2 raised its range to `^1.42.3`.
  - The editor's `prosemirror-view` peer closes that gap. Measured with npm: a
    lockfile at `@tiptap/pm` 3.31.1 holding view 1.42.2 and model 1.25.11 is
    lifted to one view 1.42.5 and one model 1.25.12 when the peer arrives, and
    pinning the old pair fails with `ERESOLVE`. Without the peer, the same
    lockfile keeps 1.42.2. A lockfile at `@tiptap/pm` 3.31.3 holding view
    1.42.4 is lifted to 1.42.5 the same way, and pinning 1.42.4 fails with
    `ERESOLVE`.
  - The workspace builds and tests against Tiptap 3.31.3.
- **You need exactly one `prosemirror-model`, and it must be ≥ 1.25.12 whenever
  `prosemirror-view` is ≥ 1.42.5.**
  - `prosemirror-view` 1.42.5 no longer checks pasted context attributes itself.
    It relies on `NodeType.create` validating them, and that validation only
    arrived in `prosemirror-model` 1.25.12.
  - So a second, older model copy (the one your schema was built from) silently
    turns the fix off.
  - A duplicated model also breaks `instanceof` checks and wrapping or
    splitting nodes. Tiptap ≥ 3.30 logs a `[tiptap warn]` saying
    "prosemirror-model is loaded more than once" when it sees one.
  - To fix a duplicate, run `npm dedupe` or
    `yarn dedupe prosemirror-view prosemirror-model`, or add an `overrides` /
    `resolutions` entry.
- **Keep all twelve `@tiptap/*` packages on the same version.**
  - Since 3.30.0, StarterKit pins its bundled extensions to its own exact
    version.
  - A mismatched `@tiptap/core` therefore yields two cores, not one shared copy.

## The advisories, as verified

The issue's table was assembled by an audit, not taken from the advisories.
Against the advisories, GHSA-j95f is in the wrong package, both severities
match only the repository advisory and are swapped in the reviewed record, and
the issue's reachability claim for GHSA-j95f is false. The table below was
re-derived on 2026-09-23 from three sources:

- the Tiptap repository advisories
  (`gh api repos/ueberdosis/tiptap/security-advisories`);
- the reviewed GitHub Advisory Database records (`gh api advisories/<id>`);
- the ProseMirror repository advisory.

| Advisory                                                                                                       | Package            | Affected                  | Fixed      | Severity                            | Reach in `@malva-ui/editor`                                                                                        |
| -------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------- | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [GHSA-cp6q-959q-f8rh](https://github.com/advisories/GHSA-cp6q-959q-f8rh)                                       | `@tiptap/core`     | ≥ 2.0.0-alpha.0, < 3.30.4 | **3.30.4** | high (repo) / **medium** (reviewed) | helper used by every preset `renderHTML`; pinned at the helper                                                     |
| [GHSA-c8x8-7fp4-3x9w](https://github.com/ProseMirror/prosemirror-view/security/advisories/GHSA-c8x8-7fp4-3x9w) | `prosemirror-view` | < 1.42.3                  | **1.42.3** | high                                | every editable editor pastes; enforcement bites on attributes that declare `validate` — none in the default preset |
| [GHSA-j95f-988m-3j2f](https://github.com/advisories/GHSA-j95f-988m-3j2f)                                       | **`@tiptap/core`** | ≥ 3.7.0, < 3.30.5         | **3.30.5** | medium (repo) / **high** (reviewed) | **not reachable through the default preset**; reachable through consumer extensions built on the helpers           |

- **GHSA-cp6q (`mergeAttributes`)**
  - Before 3.30.4, an own `__proto__` key in an attributes object invoked the
    legacy prototype setter. An object built by `JSON.parse` has such a key.
  - Its members then became _inherited_ keys, invisible to
    `Object.keys` but visited by ProseMirror's `for…in` DOM serializer. Example:
    `onerror`.
- **GHSA-c8x8 (paste)**
  - This is a ProseMirror repository advisory. At verification time the global
    database returned 404 for it, so `npm audit` does not report it.
  - `prosemirror-view` rebuilt the wrapping nodes of a pasted slice from the
    clipboard's `data-pm-slice` JSON, with whatever attributes that JSON named,
    and skipped the schema's validators.
  - `@tiptap/pm` 3.31.2 is the first Tiptap release that requires the fix.
    The editor's own `prosemirror-view: ^1.42.5` peer requires it (and the
    model pairing) whatever the `@tiptap/pm` patch.
- **GHSA-j95f (ReDoS)**
  - The issue places it in `@tiptap/markdown` and calls it "reachable through
    ordinary `format="markdown"` values". **Both are wrong.**
  - The quadratic parsers are `createBlockMarkdownSpec`,
    `createAtomBlockMarkdownSpec` and `createInlineMarkdownSpec` in
    `@tiptap/core`.
  - A tokenizer those helpers build matches only its own node name
    (`^:::${name}`, `[${name} …]`), so no Markdown payload can prove the preset
    unreachable. What proves it is the registry: the preset registers exactly
    five Markdown tokenizers (`orderedList`, `underline`, `taskList`, `table`,
    `highlight`), none of them built by those helpers.
  - Measured on the helpers directly: block payloads of 5.1, 10.3 and 20.5 KB
    took 26, 93 and 391 ms on 3.29.2 (about 4x per doubling, i.e. quadratic)
    and 0 ms on 3.31.3.
- **GHSA-pmh9-4rj3-c67g** (`@tiptap/extension-collaboration-caret`, fixed in
  3.31.3) is not a peer and is not reachable. It is mentioned only because 3.31.3
  is the target.

## Why 3.31.3

- It is the newest 3.31.x, and it is published for all twelve peers.
- `scripts/widen-peer-range.mjs` widens the exact pin to `^3.31.0`. VERSIONING
  §9 keeps a minor floor for Tiptap.
- The publish script (`scripts/publish.mjs`) and the playground manifest
  (`apps/docs/tools/playground-manifest.ts`) both read the version from the
  `@tiptap/core` pin. Neither needed a change.

## Why explicit ProseMirror peers, not a `^3.31.2` floor

- A `^3.31.2` Tiptap floor would close the view gap only. Every `@tiptap/pm`
  3.31.x asks `prosemirror-model ^1.25.11`, so it cannot require model
  ≥ 1.25.12.
- It would also need a per-package patch-floor branch in
  `widen-peer-range.mjs` and an exception to VERSIONING §9's minor floor, which
  every later Tiptap bump would inherit.
- Two hand-written peers state both floors directly, in the same form as
  `@malva-ui/tailwind`'s `tailwindcss: ^4.0.0`. The Tiptap range keeps its
  ordinary widened form.
- They pass through the existing machinery unchanged: `widenPeerRange` leaves
  an existing range alone, `publish.mjs` has no placeholder to resolve, and the
  playground installs the declared range. `scripts/widen-peer-range.spec.mjs`
  and `apps/docs/tools/playground-corpus.spec.ts` pin both.

## Inherited behaviour

Every row of the [behaviour table](#behaviour-329--331) is pinned in
`libs/editor/src/lib/extensions/editor-upstream-behaviour.spec.ts`. Each was
run on 3.29.2 before the bump and **failed there** for the stated reason. The
three exceptions are guards, which pass on both versions: the Markdown
tokenizer allowlist (once per format) and Tab falling through where no list
precedes the caret.

**Markdown values (`format="markdown"`)**

- **Unclosed inline HTML no longer fails to load** (3.30.0).
  - `Hello <b>world` used to build an invalid document. `MlvEditor` then
    reverted the value and emitted a `parse` error.
  - Now the tag is dropped and its text kept. There is no error, and the model
    keeps the value it was given.
  - Tests: `editor.spec.ts` › _accepts a Markdown value with an unclosed inline
    HTML tag instead of reporting a parse error_; the spec's _loads Markdown with
    an unclosed inline HTML tag, dropping the tag_.
- **Serialized Markdown changes bytes** (3.30.6). Stored Markdown that
  round-trips through the editor will diff:
  - A block nested under an ordered item is now indented by the marker's width.
    `1. one\n   - nested` has three spaces; 3.29 wrote two, which other tools
    read as a sibling list. Bullets are unchanged at two spaces.
  - Whitespace-only marked text no longer emits empty delimiters: `a b`, not
    `a**** b`.
  - Tests: _indents a nested block under an ordered item to the marker width_;
    _serializes whitespace-only marked text without empty delimiters_.
- **A `$$` line ends an ordered list item** (3.30.0).
  - It used to fold into the item's text.
  - The preset ships no math extension, so the block becomes a literal
    paragraph after the list.
  - Test: _ends an ordered list item at a `$$` line_.

**Keyboard**

- **Tab is consumed at the start of a paragraph that directly follows a list**
  (3.30.0).
  - `ListKeymap` sinks the paragraph into the list's last item. This applies to
    bullet, ordered and task lists.
  - At that one caret position, Tab therefore no longer moves focus out of the
    editor. Tab was already consumed inside a list item that can be sunk (any
    but the first; `sinkListItem`). In the first item it still falls through.
  - Elsewhere Tab falls through as before.
  - Accepted as inherited: the editor does not remove `ListKeymap`'s Tab
    binding.
  - Tests: _consumes Tab at the start of a paragraph after a %s, sinking it into
    the last item_ (bullet, ordered and task list); guard _still lets Tab fall
    through where no list precedes the caret_.
- **Backspace at the start of a list item's second paragraph joins it to the
  first** (`<li><p>firstsecond</p></li>`, 3.30.0).
  - It used to lift the whole item out of the list.
  - This is undocumented upstream: tiptap commit `0247d3987` (#7893) appears in
    no changelog.
  - Test: _joins, rather than lifts, on Backspace at the start of a list item’s
    second paragraph_.
- **Backspace that merges a paragraph into a blockquote leaves the caret after
  the merged text**, not at the join point (3.30.0).
  - This is deliberate upstream. Tiptap commit `4ec64c7cb` (#7984) fixed
    Backspace freezing after that merge by setting the selection to the end of
    the merged content.
  - Its end-to-end test, "backspace after merge", expects `A` + `B` →
    Backspace → Backspace → `A`: the second Backspace keeps deleting inside the
    blockquote.
  - Test: _places the caret after the merged text when Backspace merges a
    paragraph into a blockquote_.

**Commands and node views**

- **Unsetting colour inside a blockquote, list item or table cell** now keeps
  the colour of text outside the selection (3.30.3). It used to strip every
  colour in the container.
  - Test: _keeps the colour of text outside the selection when unsetting colour
    inside a %s_.
- **Deleting the last table row or column keeps the selection inside the
  table** (3.30.0). It used to jump to the block below. Both the toolbar table
  menu and the in-canvas grips run these commands.
  - Test: _keeps the selection inside the table after %s removes the last one_.
- **A resizable image whose source fails to load is revealed** (3.30.2).
  - The node view waited for `load` alone, so a broken or cached image stayed
    at `visibility: hidden` with pointer events off.
  - Test: _reveals a resizable image whose source fails to load_.
- **Task item checkboxes are named by attribute and by label text** (3.30.0).
  - The checkbox gains an `aria-label` attribute. It used to be set only as an
    IDL property.
  - The wrapping `<label>` gains a `<span>` with the same text. Upstream hides
    it with an inline visually-hidden style (absolute, 1px × 1px, clipped,
    `overflow: hidden`, `white-space: nowrap`), so there is no layout change.
  - A consumer selector or snapshot that expected an empty label will diff.
  - Test: _names a task item checkbox by attribute and by its label text_.

**Security pins** (same spec, _security fixes the published peer floors
require (#291)_). The floors admit only releases that carry these fixes, and
the cases run against the versions the workspace resolves. No peer range can
prevent a second, older `prosemirror-model` copy, which still disables the
GHSA-c8x8 case (see [What consumers change](#what-consumers-change)).

- GHSA-cp6q: _keeps an own \_\_proto\_\_ key from re-parenting the object
  mergeAttributes returns_.
- GHSA-c8x8: _validates the attributes a pasted slice context supplies_.
  - A probe node declares a `validate`d attribute. A valid context value
    survives the paste; `javascript:alert(1)` makes the view drop the wrapper.
- GHSA-j95f, a guard: _registers only the audited Markdown tokenizers in the
  %s preset_ (Markdown and HTML formats).
  - It asserts the exact set of registered Markdown tokenizers. Adding or
    replacing a tokenizer-bearing extension fails it, and the new tokenizer has
    to be checked against the advisory before the list is updated.

## Checked and unchanged

- **`setContent` / `clearContent`.** The editor's load, clear and recovery
  paths behave the same. Every existing spec passed on 3.31.3 before any spec
  was added.
- **`@tiptap/extensions`.** It has no changelog entries between 3.29.2 and
  3.31.3.
- **Option names.** No option the preset sets was renamed.
- **Node views.** No Malva code subclasses a Tiptap node view or imports
  `@tiptap/pm/schema-list`. That subpath's export map was repaired in 3.30.0.
- **The `ResizableNodeView` minimum-size workaround** (`MLV_EDITOR_IMAGE_MIN_SIZE`)
  is still required.
  - The Image extension still forwards a `min` object whose `width` and
    `height` are `undefined` when unset. The node view spreads it over its
    `{ width: 8, height: 8 }` defaults and erases them.
- **Build.** Tiptap now builds with `vp pack`. `ng-packagr` (`editor:build`) and
  the docs AOT build both consume the new bundles cleanly.

## Not fixed here

- **`marked` 17.0.6** lexes long `__` runs quadratically. `@tiptap/markdown`
  depends on it; it is not bundled. (It is nested under `@tiptap/markdown`
  only in this workspace; a typical consumer tree hoists it to
  `node_modules/marked`.)
  - This is independent of GHSA-j95f and predates this change.
  - 41 KB of `__QUOTED_0` repeated takes about 0.5 s; each doubling costs about
    4x.
  - It is a follow-up, not part of this floor.
- **The task item checkbox name is English only.** The preset sets no
  `a11y.checkboxLabel`, so it reads "Task item checkbox for …" in every locale.
  This predates the change; since 3.30 the same text also renders as the hidden
  label text. A follow-up.

## Workspace-internal changes

- **Root `package.json`:** all twelve `@tiptap/*` pins moved 3.29.2 → 3.31.3.
- **`libs/editor/package.json`:** gained the two hand-written ProseMirror
  peers.
- **`yarn.lock`:** regenerated.
  - Then `yarn dedupe prosemirror-view prosemirror-model`, because Yarn's
    `node-modules` linker had kept 1.42.2 beside 1.42.5 and 1.25.11 beside
    1.25.12.
  - Nothing was added to `resolutions`. The workspace now resolves one
    `prosemirror-view` (1.42.5) and one `prosemirror-model` (1.25.12).
- **New spec:** `libs/editor/src/lib/extensions/editor-upstream-behaviour.spec.ts`
  (21 tests).
- **`editor.spec.ts`:** one test added, for the shell-level Markdown
  consequence.
- **E2e:** the colour-picker test waits for `aria-controls` before reading it.
- **Install guidance:** `libs/editor/README.md` and the docs install example
  name the `@malva-ui/editor` peers, the two ProseMirror floors and the
  single-copy requirement, and link this document.
- **VERSIONING §9:** lists the two hand-written floors beside
  `@malva-ui/tailwind`'s `tailwindcss` peer. The widening rule is unchanged.
