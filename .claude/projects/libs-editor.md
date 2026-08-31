---

# Library: editor

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the editor's API, behavior, dependencies, styling, or tests change.

## Overview

The Editor library provides an SSR-safe Angular shell around a single browser-only Tiptap editor instance, its publishable dependency contract, public editor/upload types, nullable serialization boundary, composable extension presets, and replaceable command toolbar modules.

## Identity

- **Path:** `libs/editor`
- **Import path:** `@malva-ui/editor` (a standalone published package; **not** re-exported from `@malva-ui/core`)
- **Nx project:** `editor`
- **Packaging:** ng-packagr package root with `src/index.ts` as its entry file, plus the `libs/editor/ai` secondary entry point published as `@malva-ui/editor/ai`

## Current public API

`@malva-ui/editor` currently exports its public contracts and image-upload tokens:

- `MlvEditorFormat` (`'html' | 'markdown' | 'json'`) and event payloads for
  focus, selection changes, and transactions.
- `MlvEditorContentWidth` (`'default' | 'wide' | 'full'`) for the centred
  content column width.
- `MlvEditorImageUploader`, upload context/result/options, upload source, and
  success/failure/cancelled event payloads.
- `MlvEditorError` and `MlvEditorErrorCode` for recoverable editor,
  serialization, and upload failures.
- `MLV_EDITOR_IMAGE_UPLOADER`, the optional dependency-injection token for a
  host-provided uploader.
- `MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS`, with `accept: ['image/*']`, a
  10 MiB `maxSize`, and `maxFiles: 1`.
- The AI toolkit symbols (provider contract, streaming engine, per-editor
  context, and `MlvEditorAiMenu`) — exported here for single-module identity
  and mirrored by the `@malva-ui/editor/ai` facade, which is the documented
  import path. See the AI toolkit section below.

## `MlvEditor` component contract

Import `MlvEditor` from `@malva-ui/editor` and render it as
`<mlv-editor>`. Its direct editor API is:

| Kind   | Name                   | Type / default                                                            |
| ------ | ---------------------- | ------------------------------------------------------------------------- |
| Model  | `value`                | `ModelSignal<string \| null>` / `null`                                    |
| Input  | `format`               | `'html' \| 'markdown' \| 'json'` / `'html'`                               |
| Input  | `contentWidth`         | `MlvEditorContentWidth` / `'default'`                                     |
| Input  | `extensions`           | `Extensions \| undefined`; a complete replacement                         |
| Input  | `placeholder`          | `string` / `'Write something…'`                                           |
| Input  | `characterLimit`       | `number \| null` / `null`                                                 |
| Input  | `ariaLabel`            | `string \| undefined`                                                     |
| Input  | `ariaLabelledBy`       | `string \| undefined`                                                     |
| Input  | `ariaDescribedBy`      | `string \| undefined`                                                     |
| Input  | `imageUploader`        | `MlvEditorImageUploader \| undefined`                                     |
| Input  | `imageUploadOptions`   | `MlvEditorImageUploadOptions` / `MLV_EDITOR_DEFAULT_IMAGE_UPLOAD_OPTIONS` |
| Input  | `aiProvider`           | `MlvEditorAiProvider \| undefined`; wins over `MLV_EDITOR_AI_PROVIDER`    |
| Signal | `editor`               | readonly `Signal<Editor \| null>`                                         |
| Signal | `zoom`                 | writable view-only percentage, initially `100`                            |
| Signal | `editable`             | readonly effective mutation availability                                  |
| Output | `editorReady`          | `Editor`                                                                  |
| Output | `focus` / `blur`       | `MlvEditorFocusEvent`                                                     |
| Output | `selectionChange`      | `MlvEditorSelectionChange`                                                |
| Output | `transaction`          | `MlvEditorTransactionEvent`                                               |
| Output | `editorError`          | `MlvEditorError`                                                          |
| Output | `imageUploadSuccess`   | `MlvEditorImageUploadSuccess`                                             |
| Output | `imageUploadFailure`   | `MlvEditorImageUploadFailure`                                             |
| Output | `imageUploadCancelled` | `MlvEditorImageUploadCancelled`                                           |

`format` selects the external representation only; the model type is
`string | null` in every format. `'json'` carries
`JSON.stringify(editor.getJSON())` — the Tiptap document itself — so custom
block nodes round-trip their typed attributes instead of being flattened into
HTML attributes. Hosts parse that string at their own boundary and render the
document structurally:

```html
<mlv-editor format="json" [(value)]="documentJson" label="Structured draft" />
```

```ts
// `JSONContent` comes from the Tiptap peer; Malva re-exports only the narrow
// composition types `Editor`, `EditorOptions`, `Extension`, and `Extensions`.
import type { JSONContent } from '@tiptap/core';

readonly documentJson = signal<string | null>(
  JSON.stringify({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Structured.' }] },
    ],
  }),
);

readonly parsedDocument = computed(() => {
  const json = this.documentJson();
  return json === null ? null : (JSON.parse(json) as JSONContent);
});
```

JSON needs no extra extension, so it works with the default preset and with any
literal `extensions` replacement. Switching between `'html'`, `'markdown'`, and
`'json'` serializes the live document rather than reparsing the stale string,
so no format change constructs a second editor.

The inherited Malva form surface also accepts `state`, `readonly`, `disabled`,
`loading`, `clearable`, `errors`, `touched`, `dirty`, `id`, `label`, `hint`,
and `message`, and emits `touch` when composite focus leaves. `value` supports
direct `[(value)]`, `[formControl]`, `[(ngModel)]`, and Signal Forms
`[formField]` bindings through the `FormValueControl<string | null>` contract;
the component deliberately has no CVA or `NG_VALUE_ACCESSOR`.

The library also exports fresh, composable extension factories:

- `mlvEditorFormattingExtensions()` supplies StarterKit, TextStyle/Color,
  multicolour Highlight, and heading/paragraph alignment. Its default Link
  extension uses `openOnClick: false` with neutral `target`/`rel` attributes;
  a consumer-supplied extension array remains a literal replacement.
- `mlvEditorListExtensions()` adds task lists; StarterKit supplies bullet and
  ordered lists.
- `mlvEditorTableExtensions()` configures the free `TableKit` with resizable
  columns by default.
- `mlvEditorImageExtensions()` configures resizable Image nodes with explicit
  finite `minWidth`/`minHeight` (default 8, overridable). Both must be numbers:
  Tiptap's Image extension always forwards `min: { width, height }` to
  `ResizableNodeView`, and that object is truthy even when both members are
  `undefined`, so the node view spreads them over its own `{ width: 8,
height: 8 }` defaults and erases them. Every drag then computes
  `Math.max(undefined, n)` — `NaN` — and `style.width = 'NaNpx'` is rejected by
  the CSSOM without an error, so images silently never resize while the commit
  on mouseup still writes back their unchanged size. It also, only when
  given an `onFiles` callback, intercepts pasted/dropped files for the upload
  coordinator. The active paste handler consumes the browser event so an
  HTML-bearing image paste cannot also insert duplicate content; without the
  callback both FileHandler hooks remain undefined.
- `mlvEditorUtilityExtensions()` supplies Placeholder and CharacterCount.
- `mlvEditorBlockHandleExtensions()` creates `MlvEditorBlockHandle`, which
  supplies the `moveBlock`/`moveBlockUp`/`moveBlockDown` commands and the
  `Alt+Shift+ArrowUp`/`Alt+Shift+ArrowDown` keymap for reordering top-level
  blocks. Every `MlvEditorBlockHandleOptions` member (`mount`, `label`,
  `announceMove`, `enabled`) is host-supplied; omitting them yields an inert
  handle that never mounts, which is what a bare `mlvEditorDefaultExtensions()`
  call outside the `MlvEditor` shell produces. It is part of the default
  preset; a literal `extensions` replacement omits it, so the gutter handle
  never mounts and the keymap stays unregistered.
  `mlvEditorDefaultExtensions({ blockHandle })` forwards those capabilities.
  Its ProseMirror plugin view appends one `.mlv-editor__block-handle` element
  to the mount container and follows the hovered top-level block, writing
  `data-index` and `data-visible`. The element is `aria-hidden`, carries no
  `tabindex`, and is never a document node, so it cannot reach any serialized
  representation and the content region stays the single `role="textbox"` tab
  stop. Dragging that handle reorders the block through the same `moveBlock`
  command, previewed by a lifted copy of the block on the cursor, a
  `.mlv-editor__drop-indicator` line, and the neighbouring blocks parting to
  open the space it would land in — none of them document nodes. `destroy()`
  removes both mount elements, the drag image, both pointer listeners, the
  mount drag listeners, and the `document` keydown listener.
- `mlvEditorMarkdownExtensions()` creates the official beta Markdown
  extension. The factory includes it only when
  `mlvEditorDefaultExtensions({ format: 'markdown' })` is requested; the
  `MlvEditor` shell requests that capable default once so changing `format`
  can round-trip the current document without recreating Tiptap.

Every factory creates a fresh array and fresh extension instances. The default
preset has unique extension names and also includes
`MlvEditorUploadPlaceholder`, which uses ProseMirror widget decorations—not
document nodes—for uniquely identified upload progress. Its
`insertUploadPlaceholder`, `updateUploadPlaceholder`, and
`removeUploadPlaceholder` commands and readonly placeholder storage are public
for the later upload coordinator. Progress is always a finite 0–100 value;
non-finite values normalize to zero. Decoration state is excluded from HTML,
Markdown, and JSON serialization.

The library exports `MlvEditor` (`mlv-editor`). It is a nullable
`MlvSignalFormControlBase<string | null>` and therefore supports direct
`[(value)]`, reactive forms, `ngModel`, and Signal Forms without a CVA or an
`NG_VALUE_ACCESSOR` provider. Its one Tiptap `Editor` is created only after the
content mount is rendered in a browser; server rendering leaves the shell
intact without constructing Tiptap. The model emits `null` for semantically
empty documents and preserves the latest valid value after parse or
serialization errors. `format` switches serialize the current document rather
than recreating the editor.

`contentWidth` centres the editable column at a reading measure and reserves a
horizontal gutter on both sides, present at every value including `full`. The
gutter holds the block drag handle, a pointer affordance that is `aria-hidden`
and outside the tab order because the content region is one textbox tab stop.
Dragging reorders top-level blocks only, without reparenting into lists or
table cells. Keyboard users press `Alt+Shift+ArrowUp` and `Alt+Shift+ArrowDown`,
which run the same `moveBlock` command and announce the result through the CDK
`LiveAnnouncer` at `polite`. Both paths produce exactly one undo step. The
handle mounts inside the zoom-transformed layer, so it stays aligned at every
zoom level.

The shell constructs Tiptap against an empty document and applies all initial
and later values through strict schema-aware parsing. Every external
application (initial value, later programmatic sets, and clears) dispatches
with `addToHistory: false` through one chained transaction, so it never enters
user undo history — Tiptap's bare `setContent`/`clearContent` would otherwise
land the applied document as an undoable step whose undo empties the editor.
Invalid content emits a
recoverable `parse` error and restores the last valid document/value. Value
application branches exhaustively over all three formats: HTML is parsed from
its own markup, Markdown declares `contentType: 'markdown'`, and JSON is handed
to Tiptap as a parsed document object because Tiptap reads any string argument
as HTML. Default extensions retain Markdown capability for in-place format
changes; a custom extension array is never supplemented, and a Markdown request
without its manager emits a recoverable configuration error. JSON imposes no
extension requirement and always passes preflight. The shell uses the shared
form-control wrapper's full-width surface geometry and wires visible labels,
messages, disabled state, and validation state to the actual ProseMirror
textbox.

`MlvEditorToolbarContext` is exported and provided per editor instance through
`MLV_EDITOR_TOOLBAR_CONTEXT`. It exposes the editor signal, form state,
format, view-only zoom signal, and safe `run`, `can`, and `isActive` helpers.
`run` and `can` return `false` when no editor exists, a callback throws, or the
editor is readonly/disabled. Readonly keeps the ProseMirror textbox focusable,
selectable, and copyable while blocking mutation helpers; disabled makes the
complete host inert, capture-blocks projected pointer/click/activation-key
handlers, removes the textbox from the tab order, and closes editor-owned
overlays. `isActive` remains a truthful read of the retained selection state
while disabled, so controls can render correctly after re-enable. Internal
per-editor overlay and upload-abort registries are deliberately excluded from
the package barrel; they deduplicate registrations and continue cleanup if an
application callback throws. Composite focus is owned
by the editor host rather than Tiptap's content callbacks: moving between the
content, toolbar, status, and registered editor overlay roots is internal;
only leaving the whole composite emits `blur` and `touch`.

`MlvEditorZoom` is the exported reusable view controller. Its literal
`ModelSignal<number>` defaults to 100 and synchronizes bidirectionally with the
nearest toolbar context. An explicitly bound initial model value wins even when
it equals the default; an unbound control adopts a non-default context value.
Bounds and presets are normalized to finite, strictly positive percentages,
then values clamp to normalized `min`/`max` bounds. The percentage `MlvInput`
and the level list live in a named modal Malva popup rather than mixed content
in a menu: the field sits at the top over a hairline, and the presets (plus the
optional Fit row, always last) render as one `mlv-dropdown-panel` listbox
underneath — a compact vertical menu, one tab stop with arrow-key navigation,
scrolling in the panel's own scrollbar so the field stays pinned. Fit rides the
list as an option with the sentinel value `0`, which no strictly positive
percentage can collide with. The aria listbox also emits while reconciling its
value against the rendered options — a free-form percentage that matches no
preset reconciles to an empty array — so only a non-empty emission is treated
as a pick. `MlvEditorZoom` provides its own `MlvSelectionService`, which the
detached panel injects non-optionally. Opening focuses/selects the input,
Escape closes, and final overlay teardown restores the connected trigger
synchronously. A disabled editor marks every option `aria-disabled`. Optional Fit
observes through `MlvResizeObserverService`, measures the complete inner view
layer (including layout/padding overflow), uses the actual viewport client
extent, and selects the largest safe integral scale. Zoom changes only the
editor-scoped `--mlv-editor-zoom` transform on the inner view layer; they never
dispatch a Tiptap transaction or change serialization, selection, or history.
Readonly editors retain zoom, while disabled editors block closed and
already-open zoom controls.

## Toolbar modules

`MlvEditorToolbar` is the exported standalone compatibility shell. It accepts
a required `MlvEditorToolbarContext`, optional accessible label/disabled state,
and optional start/end templates while preserving direct projection slots. Its
local revision bridge follows the current context editor's public
`transaction` and `selectionUpdate` events, rebinds when that editor signal
changes, and unregisters both listeners when the shell is destroyed.
`MlvEditorToolbarRoot` is the internal (not barrel-exported) named composite
root used by both that shell and `MlvEditor`; the nested `MlvToolbar` is
layout-only for the built-in groups. Both shells keep one non-wrapping row:
the command groups and semantic vertical `MlvDivider` elements live inside a
horizontal `MlvFade` scroller, while the responsive overflow trigger remains
fixed at the row end. Command groups use compact inline-flex hosts so their
buttons never stack vertically. The default composition currently renders
these real command groups in order:
`MlvEditorUndoRedo`, `MlvEditorZoom`, `MlvEditorHeading`, `MlvEditorList`,
`MlvEditorInlineMarks`, `MlvEditorTextColor`, `MlvEditorHighlight`,
`MlvEditorAlignment`, `MlvEditorLink`, `MlvEditorTable`,
`MlvEditorBlockInsert`, and `MlvEditorImageUpload`. Semantic dividers separate
history, zoom, block type/list, inline marks, colors, alignment, link/table,
block insertion, and upload groups.
Every native built-in trigger is marked with `mlvEditorToolbarWidget`, so the
composite is one Tab stop; ArrowLeft/ArrowRight, Home, and End move between
enabled widgets and wrap. Built-in toolbar actions are icon-only Malva buttons
with localized accessible names and tooltips; the compact numeric zoom
percentage remains visible. Foreground color and highlight use distinct
projected icons while retaining separate `MlvColorPickerPopup` instances.
Consumer-projected direct or template controls must
likewise add `mlvEditorToolbarWidget`; it uses the editor-owned registry rather
than `mlvToolbarWidget`, whose nested provider is unavailable to projected
consumer declarations.

The heading control is a Paragraph/H1-H6 menu, the list control is a
Bullet/Ordered/Task menu, and alignment is a Left/Center/Right/Justify menu.

The heading trigger reports the block under the caret: `MlvButton.selected`
paints it as active while the caret sits in a heading, and the glyph swaps from
`lucide-heading` to `lucide-heading-<level>`. The level is probed across all six
levels, not only the configured `levels`, so a caret in a heading the menu
deliberately omits still reads correctly. `selected` is deliberately not
`aria-pressed`: this is a menu button, and its state semantics stay
`aria-haspopup`/`aria-expanded` plus the level-bearing accessible name (`Heading
level`) and tooltip. `_activeLevel()` reads the toolbar revision explicitly,
matching every other state-reading method in the component, so the OnPush view
is marked dirty when a transaction moves the caret across block types.
Only a menu trigger participates in toolbar roving. Menu items use the Malva
menu's Arrow, Home/End, Enter/Space, Escape, and focus-return behavior. Their
portaled panel is registered per editor with the internal composite-focus
registry while open, so entering a menu does not emit a false editor blur.

`MlvEditorTextColor` and `MlvEditorHighlight` are exported, separate swatch
picker controls. They retain the current ProseMirror selection while focus is
inside the detached picker and use distinct exact commands:
`setColor`/`unsetColor` for foreground and
`toggleHighlight({ color })`/`unsetHighlight` for background. Their active
swatches react independently to editor transactions. The shared internal
color-control directive registers the color picker's public trigger and panel
element signals with editor roving focus and composite overlay ownership.

`MlvEditorLink` is exported and supplies a Malva popup containing Malva URL
and text inputs, a new-tab toggle, and Malva apply/remove buttons. Opening on a
link expands to and preloads the whole containing mark; applying may insert,
update, or replace literal text, and removal keeps that text. Same-tab links
write null `target`/`rel`; new-tab links write `_blank` and
`noopener noreferrer`. The exact public
`allowedProtocols: InputSignal<readonly string[]>` defaults to `https`,
`http`, `mailto`, and `tel`; entries are trimmed, lowercased, and normalized
without a trailing colon. Malva rejects ambiguous, relative,
protocol-relative, query-only, and fragment-only drafts before calling
Tiptap's `setLink`. Before replacing selected text, a non-dispatching
`setLink` capability preflight checks the same final attributes against the
active Link extension policy; only a successful preflight builds the mutating
chain, whose final command remains the real `setLink`. Policy rejection is
therefore atomic and retains both the editor document and popup drafts. Escape,
apply, remove, readonly, and disabled teardown restore the connected trigger
without emitting a false editor blur.

`MlvEditorTable` is exported and occupies the documented slot between link and
block insertion in both the built-in editor and standalone public toolbar. It
hides when the replacement extension set does not register table insertion.
Outside a table, its named modal popup opens a semantic 10×10 roving-focus
grid at a 3×3 default and an enabled header-row option. Pointer hover plus
Arrow keys, Home, End, Enter, and Space select and insert the exact dimensions
through the editor context. The panel hugs the grid (`width: max-content`) and
carries `--mlv-popover-inset` itself, because `mlv-popup` ships no panel
padding; a `.mlv-editor-table__footer` pairs an `aria-hidden`
`.mlv-editor-table__size` caption (`R × C`, mirroring the highlighted swatches)
with the header-row toggle. Swatches are plain buttons, not `mlvButton` — the
button height ramp, radius and hover fill fight a 1.25rem square.

Inside a table the widget swaps shells: the same trigger becomes an
`mlv-menu` button carrying the real row, column, merge, split, header-row,
header-column, header-cell, and delete commands in five separated groups. It
is never a toggle — outside a table it is `aria-haspopup="dialog"`, inside one
`aria-haspopup="menu"` plus the `mlv-button--selected` paint, and it carries no
`aria-pressed` in either mode. The header-cell row marks the caret cell's
current state with `aria-current`. Registered commands stay visible while
`editor.can()` drives their `aria-disabled`; every mutation passes through the
context guard. Each command is declared as a **pair** — a dispatching
`_command` and a dry-run `_canCommand` built on `editor.can()` — because
`[disabled]` bindings re-evaluate on every change-detection pass, so handing a
dispatching command to a capability binding mutates the document merely by
rendering. The menu panel registers with the editor's overlay registry
(`queueMicrotask` + `menu.panelId`) so it counts as inside the composite-focus
boundary and emits no false blur. Default table node views remain resizable and
render their wrapper, column geometry, selected-cell overlay, resize handle,
and resize-cursor states with Malva theme tokens.

### `MlvEditorTableControls` — in-canvas hover grips

`mlv-editor-table-controls` mounts inside `.mlv-editor__view`, the zoom layer,
next to the block handle, and is `aria-hidden` chrome: pointer-only, every grip
`tabindex="-1"`, with the toolbar menu above as the keyboard route to the same
commands. A document-level `pointermove` listener tracks the hovered cell;
because the listener is on the document, each instance first checks
`layer().contains(cell)` so two editors on one page do not paint each other's
grips. Placement is a pure function — `mlvEditorTableGeometry()` in
`table/editor-table-geometry.ts` — which unscales viewport rects by the live
layer scale (`getBoundingClientRect().width / offsetWidth`, not the CSS
variable) into the layer's unscaled coordinate space and returns three boxes:
`row` (left of the table, aligned to the cell), `column` (above the table,
aligned to the cell) and `corner`. Each grip opens an `mlv-menu` scoped to what
it points at — 4 row commands, 4 column commands, 6 table-wide commands — and
`_run()` first moves the selection into the hovered cell via
`view.posAtDOM(cell, 0)` + `setTextSelection` so the command applies to the
cell under the pointer rather than the caret. Grips pin while their menu is
open. i18n: `rowActions`, `columnActions`, `tableActions`.

Command presence and temporary executability are intentionally distinct. A
control hides only when its extension does not register the command; otherwise
it remains visible and reevaluates `editor.can()` and `editor.isActive()` after
every Tiptap transaction or selection update. Direct toolbar commands use a
focused chain to preserve the document selection; detached popup actions retain
that selection without stealing focus from their panel controls. Final `run()`
guards prevent mutation in readonly or disabled editors. Inline and block
toggles expose their active state with `aria-pressed`; menu options expose
current state.

The exported `MlvEditorToolbarDef`, `MlvEditorToolbarStartDef`, and
`MlvEditorToolbarEndDef` directives each declare an Angular template-context
guard and accept `MlvEditorToolbarContext` as their typed implicit value. A
complete toolbar definition replaces built-ins while remaining inside the named
outer toolbar; start direct controls render before start templates, and end
templates render before end direct controls, regardless of declaration order.
Custom projected components can inject the
public `MLV_EDITOR_TOOLBAR_CONTEXT`; each editor provides an isolated context.
Direct projected start/end controls remain supported for the editor composite
focus boundary. The toolbar observes its own available width through the Malva
resize abstraction. On narrow surfaces, inline marks, alignment, and block
commands move into the localized `More formatting` menu in logical DOM order
while heading, lists, history, and zoom remain directly reachable. Overflow
omits commands that the active extension set did not register, then separately
uses non-mutating `can()` checks for current-selection disabled state. When a
narrow toolbar widens with overflow open, it closes the detached panel and
restores focus to a visible roving widget. Hidden overflow remains skipped by
roving focus. `MlvEditorZoom` exposes `zoom: ModelSignal<number>`,
`zoomLevels: InputSignal<readonly number[]>`, `min`, and `max`; the editor
context remains the shared source when the control is used in either toolbar
shell. Its popup is an `mlv-input` over an `mlv-dropdown-panel` of preset
levels (plus `Fit to container`), and the panel carries `--mlv-popover-inset`
itself — `mlv-popup` ships no panel padding, and edge-to-edge rows (the
dropdown panel's own norm, as in select and combobox) read wrong beside the
toolbar menus this panel sits next to. The list's own block padding is zeroed
so the two do not stack.

The library exports the narrow Tiptap composition types `Editor`,
`EditorOptions`, `Extension`, and `Extensions`, but never re-exports a whole
Tiptap package.

## Image uploads

Hosts supply `MlvEditorImageUploader.upload(file, context)` either through the
per-editor `imageUploader` input or `MLV_EDITOR_IMAGE_UPLOADER`; the input wins.
The context identifies `button`, `paste`, or `drop`, exposes an `AbortSignal`,
and accepts finite 0–100 progress reports. One editor-scoped coordinator
validates `accept`, `maxSize`, and `maxFiles`, creates non-serializing
placeholders, and serves the toolbar dialog, paste, and drop paths. It inserts
only a valid `MlvEditorImageUploadResult`; the default URL policy accepts
absolute HTTP(S) URLs with a hostname and no credentials, whitespace, or
control characters. A host can provide a stricter or alternate `urlPolicy`.

The Malva dialog is opened through `MlvDialogService.open()` with `config.title`
(the localized `uploadImage` string); the dialog component renders the
`<mlv-dialog>` surface with `<mlv-dialog-header />` (title and `aria-labelledby`
from that config title, close button on), `<mlv-dialog-body>` and
`<mlv-dialog-footer>`. It uses `MlvFileUpload`, requires alternative text unless the
image is marked decorative, supports optional title text, reports progress,
and restores focus on close. Pending UI supports cancel, retry, and removal.
Explicit cancellation emits `imageUploadCancelled`; lifecycle aborts are
silent. Success and failure emit their typed upload outputs, while failures
also reach `editorError`. The stable error codes are `configuration`, `parse`,
`serialize`, `unsupported-command`, `upload-validation`, `upload-transport`,
`upload-result`, `ai-transport`, and `ai-result`.

## AI toolkit (`@malva-ui/editor/ai`)

Phases 1 and 2 of the AI toolkit (design spec:
`docs/superpowers/specs/2026-08-01-editor-ai-toolkit-design.md`): selection
transforms with streaming insert, and suggestion/diff review. Bring-your-own
transport — the library never performs network requests.

- **Entry point and layout:** `libs/editor/ai` is an ng-packagr secondary
  entry point publishing `@malva-ui/editor/ai`, the documented import path.
  The implementation lives in the primary entry under `libs/editor/src/lib/ai/`
  because the ai entry depends on the primary — a direct primary → ai import
  would be a package cycle, and cross-entry relative imports would compile
  shared modules into both bundles and fork `InjectionToken`/`WeakMap`/
  `PluginKey` identity. `libs/editor/ai/src/index.ts` is therefore a facade of
  **named re-exports from `'@malva-ui/editor'`**. When adding AI symbols:
  export from `libs/editor/src/index.ts` first, then mirror the name in the
  facade. ESM tree-shaking keeps non-AI consumers pay-nothing.
- **Provider contract** (`editor-ai.types.ts`): `MlvEditorAiProvider.stream(request): AsyncIterable<string>`
  returns plain Markdown/text chunks; non-streaming hosts return a
  single-chunk iterable. `MlvEditorAiRequest` carries
  `kind: MlvEditorAiTransformKind | 'autocomplete'`, optional `instruction`
  (custom prompt, tone, or language), `context.selection`/`context.document`
  as Markdown (`null` when empty; plain-text fallback without a Markdown
  manager), an `AbortSignal`, and host `meta` passthrough. The provider owns
  prompting, models, and policy — it never receives a prebuilt prompt.
  `MlvEditorAiBuiltInTransformKind` is the closed list the library ships copy
  and menu entries for —
  `'improve' | 'fix-grammar' | 'shorten' | 'extend' | 'summarize' | 'tone' | 'translate' | 'custom'`
  — while `MlvEditorAiTransformKind` is **open**:
  `MlvEditorAiBuiltInTransformKind | (string & {})`. The `(string & {})` arm
  admits any host-authored kind while keeping the built-in literals in
  autocomplete. Nothing in the library branches on a kind; it is forwarded
  verbatim on `request.kind`. Consequence for providers: **`request.kind` is
  not exhaustively checkable** — a `switch` over it needs a `default` that
  tolerates kinds it does not know (a host action list can name any of them).
  `MlvEditorAiOutputMode` is `'replace-selection' | 'insert-below' | 'review'`.

  **Target region of a replacing transform.** `'replace-selection'` and
  `'review'` both resolve their write region through the exported
  `mlvEditorAiReplaceRange(editor)`: a non-empty selection **is** the region;
  a **collapsed** selection targets the whole document body instead
  (`TextSelection.atStart(doc).from` .. `TextSelection.atEnd(doc).to`), never
  the raw caret. Asking to rewrite with nothing selected means "rewrite this
  document", and it already matches what the provider was handed —
  `context.selection` is `null` exactly when the selection is empty, while
  `context.document` always carries the whole document. `'insert-below'` never
  replaces and is unaffected: it still appends a block after the caret's own
  top-level block. The checkpoint/undo machinery is unchanged — a cancelled
  whole-document rewrite restores through the same region-local revert.
  `MlvEditorAiAction` is the menu's public entry shape:
  `{ kind; label; instruction?; output?; run? }` — `label` is already-resolved
  display text (the menu never translates it), `output` defaults to
  `'replace-selection'`, and `run?: (context: MlvEditorAiContext) => void` is
  the escape hatch (see the menu bullet). `editor-ai.types.ts` type-imports
  `MlvEditorAiContext` for that callback; the import is erased, so the
  types ↔ context edge is a type-level cycle only and no module cycle exists.

- **Provider resolution:** the `aiProvider` input on `mlv-editor` wins over
  the `MLV_EDITOR_AI_PROVIDER` token (uploader precedence rule).
- **Streaming engine** (`editor-ai-stream.ts`, framework-free):
  `runMlvEditorAiStream(...)` checkpoints the doc JSON before the first
  mutating step, buffers chunks per animation frame, applies interim writes
  with `addToHistory: false`, and commits one history-visible step — exactly
  one undo step per transform. Interim writes render chunks as plain text;
  the final commit parses the accumulated Markdown through the editor's
  Markdown manager into real structure (a one-line paragraph result replaces
  the selection inline without splitting its block; editors without a
  Markdown manager commit plain text, mirroring the context's serialization
  fallback). Cancel/abort and external `docChanged` mid-stream abandon the
  session and restore the checkpoint; the session plugin claims Escape in the
  content region while running and routes it to the same cancellation.
  `revealCharsPerFrame` (default 4, `Infinity` = uncapped, floor/fallback
  normalization) caps the characters one flush reveals; the remainder
  carries over on self-scheduled frames, so bursty chunks render at a
  steady typing cadence — settlement is never delayed, the commit always
  applies the complete text. Interim writes append at the region end, and
  the precise revert splits at the first write's end so
  prosemirror-history's deferred mapping of earlier undo items (ReplaceStep
  maps `to` with assoc -1, pinning it there) never crosses a replaced
  range's interior. View decorations while writing: the region tint
  `MLV_EDITOR_AI_STREAMING_CLASS` (`mlv-editor__ai-streaming`); one one-shot
  `MLV_EDITOR_AI_STREAMING_CHUNK_CLASS` (`mlv-editor__ai-streaming-chunk`)
  entrance per revealed slice — created once, then only mapped, so its
  fade/blur animation never re-runs over earlier text; and the `aria-hidden`
  `MLV_EDITOR_AI_CARET_CLASS` (`mlv-editor__ai-caret`) shimmer-caret widget
  at the insertion tip. All are removed on settle and excluded from all
  serialization; `prefers-reduced-motion` collapses chunk and caret to
  static (`animation: none`), print hides the caret and de-animates the
  chunk (it wraps real text). Related exported types:
  `MlvEditorAiStream{OutputMode,ErrorCode,Status,Options,Result,Handle}`,
  `MlvEditorAiFrameScheduler`. `output: 'review'` is the engine's
  collect-only mode: no flush is ever scheduled, nothing is written, no
  decoration renders, and the `committed` result carries only the
  accumulated `text` — Escape-cancel, external-`docChanged` abandonment,
  and `ai-transport`/`ai-result` detection apply unchanged.
- **Suggestion engine** (`editor-ai-suggestions.ts`, framework-free):
  `applyMlvEditorAiSuggestions(editor, { from, to, replacementMarkdown })`
  → `MlvEditorAiSuggestionsSession | null` (`null`: destroyed editor,
  out-of-range positions, unusable replacement, or a replacement identical
  to the region). Storage is the spec's option B — applied edits + plugin
  state + decorations: inserted text enters the document immediately under
  the inline `MLV_EDITOR_AI_SUGGESTION_INSERT_CLASS` decoration; deleted
  text is removed and re-rendered at its position as a strikethrough
  `aria-hidden` widget (`MLV_EDITOR_AI_SUGGESTION_DELETE_CLASS`).
  Decorations never serialize, so `getHTML`/`getMarkdown`/`getJSON` during
  review emit the accepted-by-default state. Diff granularity: a plain
  single-textblock region and a single plain-paragraph replacement are
  token-diffed through the internal `mlvEditorAiWordDiff` helper (LCS over
  whitespace/word tokens producing `MlvEditorAiWordDiffRun` runs; a cell
  budget collapses degenerate sizes to one replace) into individual
  insert/delete/replace suggestions — the helper and its run type are
  module-level exports **deliberately excluded from the public barrels**
  (implementation detail of the suggestion engine, not consumer API);
  structural or formatted content on
  either side falls back to **one** whole-region replace suggestion whose
  block replacement grows to textblock boundaries so no emptied source
  shell survives serialization or reject. A replacement that reproduces the
  document — echoed formatted or structural content included — returns
  `null` on this path too, the same no-changes contract as the empty word
  diff. Undo semantics: the whole
  application is exactly one history-visible step (one undo reverts every
  change and — because it intersects every range — drops the session);
  each `reject(id)` is one step and `rejectAll()` one step total, while
  `accept(id)`/`acceptAll()`/`setCurrent(id | null)` dispatch no document
  step and create **no history entry**. Concurrent-edit drop policy: user
  transactions remap all ranges through their step maps; a step that
  touches a suggestion's range (strict overlap; for collapsed delete
  widgets a spanning replacement or an insertion exactly at the anchor)
  drops just that suggestion — decorations removed, current document text
  stands, nothing restored. One session per editor (a new application ends
  the previous session, leaving its remainder accepted-by-default); the
  session ends when the set empties and on editor destroy.
- **Angular context** (`editor-ai-context.ts`): `MlvEditorAiContext`,
  provided per editor by `MlvEditor` and injectable via
  `MLV_EDITOR_AI_CONTEXT`. Surface: `status: Signal<MlvEditorAiStatus>`
  (`'idle' | 'running' | 'reviewing'`), `hasProvider: Signal<boolean>`,
  `runTransform(kind, options?: MlvEditorAiTransformOptions): Promise<void>`
  (resolves always, never rejects), `cancel()` (silent; aborts the request
  signal and engine session; Escape in the content region triggers it through
  the engine's session plugin), `restoreCheckpoint()` (like `cancel()`
  while running; post-commit restore is one undoable step through the toolbar
  `run` guard; while reviewing it reverts the applied suggestions and ends
  the review), and the Phase 2 review surface:
  `suggestions: Signal<readonly MlvEditorAiReviewSuggestion[]>` (`{ id,
kind, oldText, newText }` — document ranges stay internal),
  `hasPendingSuggestions: Signal<boolean>` (hosts gate saves on it:
  reviewing serializes accepted-by-default), `acceptSuggestion(id)`,
  `rejectSuggestion(id)`, `acceptAll()`, `rejectAll()` — all delegating to
  the suggestion engine, refused silently while no review is active or the
  editor is readonly/disabled (decorations stay visible) — and
  `revealSuggestion(id | null)`: outlines one suggestion as current
  (engine `setCurrent`, `MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS`
  decoration, `null` clears), scrolls its range into view, and — because
  the decorations are `aria-hidden` — politely announces its
  `describeSuggestion` description, once per reveal (repeating the current
  id re-announces nothing); the outline itself is a pure
  decoration/plugin-state affordance — no document step, no history entry —
  so it stays available in readonly editors. `describeSuggestion(id):
string | null` resolves 'Suggestion {index} of {count}' plus the
  removed/added text through the `aiCurrentSuggestionReplace`/`-Insert`/
  `-Delete` ICU keys — the non-visual equivalent of the decorations, also
  consumed by the review bar's `aria-describedby`. `output:
'review'` collects the full stream without writing (engine collect-only
  mode), then applies it over the start-of-run region (the selection, or the
  whole document body when nothing is selected — see **Target region** above)
  through
  `applyMlvEditorAiSuggestions` — re-passing the toolbar guard first: an
  editor that became readonly/disabled mid-collection refuses the
  application with the recoverable `configuration` error (checkpoint
  untouched — the collection never wrote); `status` becomes `'reviewing'`
  until the
  suggestion set empties (accept/reject calls, intersecting-edit drops, or
  undo of the application). A result identical to the region — plain,
  formatted, or structural — applies
  nothing: straight back to `'idle'` with the polite `aiReviewNoChanges`
  announcement. A `runTransform` while `'reviewing'` is refused with the
  recoverable `configuration` error, like a concurrent run. Failure routing
  via `editorError`: concurrent-run/review-pending, readonly/
  disabled/no-editor, and no-provider refusals emit
  `configuration`; stream failure or a sync provider throw emits
  `ai-transport`; empty output emits `ai-result` — the last two restore the
  checkpoint (a no-op for review, which never wrote). Announcements ride the
  CDK `LiveAnnouncer` at `polite` through
  the `aiStreamingStarted`/`aiStreamingFinished`/`aiStreamingCancelled`,
  `aiReviewStarted` (ICU `count`)/`aiReviewNoChanges`,
  `aiSuggestionAccepted`/`aiSuggestionRejected`/
  `aiAllSuggestionsAccepted`/`aiAllSuggestionsRejected`, and
  `aiCurrentSuggestion*` i18n
  keys; failures announce nothing.
- **`MlvEditorAiMenu`** (`mlv-editor-ai-menu`): optional toolbar command
  group hosts project into either toolbar shell (e.g.
  `<mlv-editor-ai-menu mlvEditorToolbarStart />`); the default toolbar
  composition is unchanged. One `LucideSparkles` icon-only trigger
  (`mlvEditorToolbarWidget`-marked, one roving tab stop) opens a Malva menu of
  the action list plus a
  custom-prompt item opening a modal Malva popup (`MlvInput` instruction,
  radio output-mode choice, Apply/Cancel). While `status() === 'running'` the
  same button becomes a stop affordance (`LucideCircleStop`, `aiCancel` label,
  menu blocked) so cancellation never destroys the focused element. Hides via
  `[hidden]` when no provider resolves; trigger and items disable — without
  hiding — while readonly/disabled or a transform is running
  (presence-vs-executability rule). Menu and prompt panels register with the
  editor composite-overlay registry, so neither emits a false editor blur.
  The action list is host-ownable — the menu is a thin layer over
  `runTransform`, and the built-in kinds are only the default:
  - `actions: InputSignal<readonly MlvEditorAiAction[] | undefined>` is a
    **literal replacement** of the built-ins, never a merge (the `extensions`
    and toolbar-def precedent). Omitted, the menu renders the seven built-ins
    labelled from `MLV_EDITOR_I18N`.
  - `showCustomPrompt: InputSignal<boolean>` (coerced, default `true`) drops
    the custom-prompt item **and** its popup: with it false the `mlv-popup`
    and its `mlv-popup-container` anchor are not rendered at all, so the
    prompt panel's composite-overlay effect never registers. The trigger is
    declared once in an `ng-template` and rendered by whichever branch
    applies, because `mlv-popup-container` requires a popup content child.
  - Clicking an entry calls `action.run(context)` when present — the escape
    hatch, receiving the live per-editor `MlvEditorAiContext` so a host can
    call `runTransform` with anything, chain calls, read the review surface,
    or do something else entirely (`kind`/`instruction`/`output` are then the
    callback's business and ignored by the menu) — otherwise
    `runTransform(action.kind, { instruction?, output ?? 'replace-selection' })`.
    Both paths re-check `_itemsDisabled()`, so readonly, disabled, and
    already-running guards hold for host callbacks too.
  - The `@for` tracks the array **index**, not `action.kind`: a host list may
    legitimately repeat a kind (two `'translate'` entries with different
    instructions), so the kind is not an identity.
  - `mlvEditorAiDefaultActions(copy: MlvEditorI18n | null | undefined): readonly MlvEditorAiAction[]`
    (`editor-ai-actions.ts`) returns those seven built-ins labelled from the
    passed copy, falling back to the English strings. The menu itself builds
    its default list with it, so the label table exists exactly once; hosts
    spread it to extend rather than replace.
- **`MlvEditorAiReviewBar`** (`mlv-editor-ai-review-bar`): optional review
  surface hosts project into the editor's status region
  (`<mlv-editor-ai-review-bar mlvEditorStatus />`, the `MlvEditorStatus`
  placement). A named `role="group"` (`aiReviewBar`), `[hidden]` while the
  nearest AI context is `'idle'` or absent — backed by an explicit
  `&[hidden] { display: none; }` guard in its own stylesheet, because the
  block's `display: inline-flex` would otherwise override the UA `[hidden]`
  rule and leave a zero-size flex item in the status row. While `'running'`
  it shows one
  stop button (`aiStopGeneration`, `LucideCircleStop`) that calls
  `cancel()`. While `'reviewing'` it shows the visible pending count
  (`aiReviewCount`, ICU `count` — deliberately **not** `aria-live`: the
  context's LiveAnnouncer messages own that channel, a live count would
  double-announce), previous/next icon buttons cycling an internal cursor
  (each move calls `revealSuggestion` → outline + scroll + polite
  description announcement), accept/reject
  icon buttons for the current suggestion (the clamped cursor auto-advances
  to the next remaining one as the list shrinks; both reference a visually
  hidden `describeSuggestion` text through `aria-describedby`, so the
  change under decision is inspectable non-visually), and
  accept-all/reject-all
  text buttons. Every control disables while readonly/disabled. The bar's
  host element registers with the composite-overlay registry per enabled
  state (disabling force-clears the registry), so bar focus never emits a
  false editor blur wherever a host renders it; teardown clears the current
  outline via `revealSuggestion(null)`.
- **i18n keys** (`MlvEditorI18n`): `aiMenu`, `aiImprove`, `aiFixGrammar`,
  `aiShorten`, `aiExtend`, `aiSummarize`, `aiTone`, `aiTranslate`, `aiCustom`,
  `aiPromptPlaceholder`, `aiOutputMode`, `aiReplaceSelection`,
  `aiInsertBelow`, `aiReviewChanges`, `aiApply`,
  `aiCancel`, `aiStreamingStarted`, `aiStreamingFinished`,
  `aiStreamingCancelled`, `aiReviewStarted` (ICU plural with `count`),
  `aiReviewNoChanges`, `aiSuggestionAccepted`, `aiSuggestionRejected`,
  `aiAllSuggestionsAccepted`, `aiAllSuggestionsRejected`, `aiReviewBar`,
  `aiReviewCount` (ICU plural with `count`), `aiPreviousSuggestion`,
  `aiNextSuggestion`, `aiAcceptSuggestion`, `aiRejectSuggestion`,
  `aiAcceptAll`, `aiRejectAll`, `aiStopGeneration`, and the
  current-suggestion descriptions `aiCurrentSuggestionReplace` (ICU
  `index`, `count`, `oldText`, `newText`), `aiCurrentSuggestionInsert`
  (ICU `index`, `count`, `newText`), `aiCurrentSuggestionDelete` (ICU
  `index`, `count`, `oldText`).
- **Tests:** `editor-ai.types.spec.ts` (contract + facade identity, the open
  kind union, `MlvEditorAiAction` with and without `run`, and the factory's
  labels/fallbacks), `editor-ai-stream.spec.ts` (engine),
  `editor-ai-suggestions.spec.ts`
  (suggestion engine, incl. `setCurrent`), `editor-ai-context.spec.ts`
  (context), `editor-ai-menu.spec.ts` (menu — plus a `host-owned action list`
  describe: defaults equal the factory output, literal replacement with no
  built-in leakage, verbatim kind/instruction/output, the
  `'replace-selection'` default, `run` called with the context instead of
  `runTransform`, a repeated kind rendering twice, `showCustomPrompt=false`
  removing item and popup, and the guards applying to host actions),
  `editor-ai-review-bar.spec.ts`
  (review bar) — all under `libs/editor/src/lib/ai/`. E2e
  (`libs/editor/e2e/editor.spec.ts`, `editorAiManifest` over the docs
  `/editor-ai` page's examples 1/2): mock streaming
  transform with the stop affordance; a review-mode custom-prompt run
  landing as insert/delete decorations with the review bar's count, then
  accept-all committing the proofread text (save button gated on
  `hasPendingSuggestions` re-enables) and reject-all restoring the exact
  original document.
- **Docs:** the dedicated `/editor-ai` "AI Kit" page (own `Editor` sidebar
  group beside the `/editor` page) — example 1 (streaming AI assistant; binds
  `[actions]` to `mlvEditorAiDefaultActions(copy)` plus one host-authored
  `'docs-headline'` entry, and its mock provider answers unknown kinds through
  an explicit fallback branch — the reference for "providers must tolerate
  kinds they don't know") and
  example 2
  (review demo: proofreading mock provider whose result word-diffs into one
  replace, one delete, and one insert; `MlvEditorAiReviewBar` in the status
  region; a `[docsAiReviewGate]` attribute directive injecting
  `MLV_EDITOR_AI_CONTEXT` on the editor element to gate the host save on
  `hasPendingSuggestions` — the documented sharp-edge pattern).
- **Remaining limitations:** document
  context is the full document (window bounding is a later refinement); no
  agent tool surface or ghost-text autocomplete yet; SSR never constructs the
  context (lazy first injection). Phase 2 specifics: the token diff applies
  only to plain single-textblock selections with plain single-paragraph
  results — everything else reviews as one whole-region suggestion; a host
  save during `'reviewing'` serializes accepted-by-default (gate on
  `hasPendingSuggestions`); suggestions dropped by intersecting edits are
  neither restored nor announced; `restoreCheckpoint()` while reviewing
  whole-doc-restores and ends the review.

## Nullable serialization

The eventual editor value is `string | null`; `null` is the sole public empty
value. Internal `normalizeEditorValue()` converts only external `null`, empty,
and whitespace-only strings to `null`; it deliberately preserves structural
markup such as `<p></p>` and `<p><br></p>` for Tiptap's schema-aware parser.

Internal `serializeEditorValue()` determines semantic emptiness from
`editor.isEmpty`, not from serialized text. An empty parsed document
serializes to `null` in every format; a nonempty document serializes through
`getHTML()`, the Markdown manager's `getMarkdown()`, or
`JSON.stringify(getJSON())`. If a serializer throws, or if a nonempty document
produces null/empty/whitespace-only serialized output, the helper returns a
recoverable `serialize` error with no replacement value. The shell can
therefore retain its last valid document and form value.

Internal `parseEditorJsonDocument()` validates an external JSON value before it
reaches Tiptap. Malformed JSON, arrays, scalars, objects without a `type`, and
nodes that are not the schema's top node all fail as recoverable `parse` errors
rather than mounting a structurally invalid document. Node types absent from
the active extension set are rejected by Tiptap's own strict parsing, so a
schema mismatch fails loudly instead of silently dropping nodes and turning the
host's next save into data loss.

Internal `editorValuesAreEquivalent()` decides whether an incoming value is a
real external change. HTML and Markdown keep exact string identity. JSON is
compared structurally, because `JSON.stringify` preserves key insertion order:
a host-supplied document and its canonical re-serialization frequently differ
as strings while describing the identical document. Applying an external JSON
value therefore emits no `valueChange`; an emission follows only a real user
transaction or an explicit format conversion.

These helpers and their result types are intentionally excluded from the public
barrel.

## Status, accessibility, SSR, and theming

`MlvEditorStatus` is public and reads the nearest editor context to expose
reactive character and Unicode-whitespace word counts. It hides when a complete
replacement extension set omits CharacterCount and announces remaining limits
when `characterLimit` is configured. The shell also accepts projected
`[mlvEditorStatus]` content, which is laid out **before** the built-in counts
and separated from them by an `mlv-spacer`, so projected status sits at the
inline start of the row and the counts stay pinned to the inline end.

SSR renders the form shell but never constructs Tiptap or touches browser-only
selection, observer, or DOM APIs; `editor()` remains `null` until browser view
initialization. The editable region is a named multiline textbox. The toolbar
uses one roving Tab stop, arrow/Home/End navigation, named icon buttons,
tooltips, semantic separators, focus-restoring overlays, and a horizontal
`MlvFade` overflow surface. Menus, color pickers, table grid, image dialog,
upload progress, task checkboxes, and resize handles expose their relevant
roles, labels, and states. Composite focus prevents toolbar and owned overlays
from producing false blur/touch events.

The shell supplies the block handle's four host capabilities to
`mlvEditorDefaultExtensions()`: `mount` returns the `position: relative`
`.mlv-editor__view` layer (through an optional `viewChild`, because the option
is typed `() => HTMLElement | null` and a required query would throw `NG0951`
rather than report the absence the contract already permits), `label` reads
`MlvEditorI18n.dragBlock`, `enabled`
is false while destroyed, disabled, or readonly, and `announceMove` formats
`MlvEditorI18n.blockMoved` with the reported `type`, one-based `position`, and
`total`, then announces it through the CDK `LiveAnnouncer` at `polite`. The
extension hands over the move payload rather than a formatted string, so the
extension itself stays framework-free; the callback deliberately reads nothing
from `editor.state`, which is still the pre-move state when it fires.

Styling is rooted at `.mlv-editor` and `.ProseMirror`, uses Malva design tokens,
and covers focus, error, readonly, disabled, headings, lists/task lists,
blockquote, code, links, horizontal rules, images, tables, selections, upload
placeholders, and counts. `--mlv-editor-zoom` is an internal view transform
hook; themes should override Malva tokens rather than document-node colors
directly. Narrow, print, and `prefers-reduced-motion` rules are included.

The editable column is centred and gutter-reserved through two component-scoped
custom properties declared on `.mlv-editor`: `--mlv-editor-measure` (the
`.ProseMirror` root's `max-inline-size`, centred via `margin-inline: auto`) and
`--mlv-editor-gutter` (`.mlv-editor__content`'s `padding-inline`, narrower under
the `40rem` breakpoint). `contentWidth` drives `--mlv-editor-measure` through
the `mlv-editor--content-width-default/-wide/-full` host modifiers (`45rem` /
`60rem` / `100%`); the gutter itself does not vary by `contentWidth`. A block
affordance anchored to `.mlv-editor__view` (which is `position: relative` for
exactly this) can therefore sit in the reserved gutter at every content width
without overlapping text.

`.mlv-editor__block-handle` occupies that gutter: `position: absolute`,
`inline-size: var(--mlv-editor-gutter)`, revealed by `data-visible='true'`
(opacity plus `pointer-events`). It hides under `@media print` and
`@media (hover: none)` — a pointer-only affordance is meaningless without
hover, and the `Alt+Shift+Arrow` keymap remains the reordering path there —
and its opacity transition collapses to `--mlv-duration-instant` under
`prefers-reduced-motion`. Its icon is sized from `--mlv-spacing-4` in CSS
rather than through intrinsic SVG `width`/`height` attributes.

Its horizontal anchor is **not** the view edge. `.mlv-editor__view` is
full-width while `.ProseMirror` is `--mlv-editor-measure` wide and centred, so
anchoring at zero would leave the handle detached from the text at the default
and wide measures. `inset-inline-start` is instead
`max(0rem, (100% - 2 * var(--mlv-editor-gutter) - var(--mlv-editor-measure)) / 2)`
— the column's start edge less this element's own gutter width — so the
handle's trailing edge lands flush with the first character at every
`contentWidth`. The `max()` covers the narrow case where the column already
fills the content box. The expression is exact for every length measure and
for the `full` value `100%`, which reduces to zero as it must; an arbitrary
percentage measure would not be exact, because the percentage resolves against
the view layer here and against the content box on `.ProseMirror`.

The plugin resolves the hovered block geometrically (scanning the rendered
children of `view.dom` in document order, mapping each to a top-level index)
rather than through `EditorView.posAtCoords`. That API cannot serve this
affordance at all: `.ProseMirror` is the text column, so the gutter is outside
`view.dom`'s rect by construction, and `posAtCoords` falls back to an
`inRect(coords, view.dom.getBoundingClientRect())` test and returns null for
every gutter position in a real browser as much as under a test DOM.

Mapping inside the loop is what makes widget decorations skippable as a
category rather than by class name, and it is paid for: `posAtDOM`, `nodeDOM`,
and `childStart` each walk linearly to the child they address, so a scan down
to the block at index _k_ is Θ(k²). Correctness was chosen over the Θ(k)
map-only-the-winner scan it replaced, because that one silently dropped a block
on the wrong side of its neighbour whenever a widget sat in the hovered gap.
The cost is only paid down to the **hovered** block, so hovering near the top
of a document is cheap at any length; it is deep hovering in a long document
that degrades, on every `mousemove`. Dragging no longer pays it at all — the
drag snapshot maps every block once at `dragstart` and resolves each `dragover`
by binary search over that array. Restoring Θ(k) for the hover path while
keeping the category skip is open follow-up work — deferring the mapping until
the rect scan has picked a winner, then walking back over the few consecutive
widgets, is the shape of it, and the clamp above the first block is the case
that makes it more than a one-liner.

The vertical offset is converted out of the zoom scale exactly once, deriving
the scale from `rect.width / offsetWidth` on the mount rather than reading
`--mlv-editor-zoom`, because `getBoundingClientRect()` reports scaled screen
pixels while a CSS `top` on a child of the scaled layer applies in that
layer's unscaled space.

The plugin view also implements `update()`, which hides the handle whenever
`enabled()` is false. The pointer handler's own check is not sufficient:
disabling the editor puts `pointer-events: none` on `.mlv-editor__surface`,
which contains the mount, so no further `mousemove` or `mouseleave` can arrive
to retract a handle that was visible at the moment the host revoked
permission. The same hook drops any in-flight drag source — both when the host
revokes permission, so releasing the button afterwards cannot reorder anything,
and whenever the document changed (`previous.doc !== updated.state.doc`, which
is exactly `docChanged` at O(1), since ProseMirror only replaces `state.doc`
when a step is applied).

### Drag lifecycle

Dragging the handle is handled entirely by this extension; ProseMirror's
`view.dragging` is deliberately never set. That native path carries a parsed
slice and would happily reparent the block into a list item or a table cell,
and accept a drop in a different editor — all of which top-level-only
reordering rules out. The drag instead remembers the source index taken from
`data-index` (absent until the first hover, so `dragstart` refuses when it or
`enabled()` is missing) and replays it through `moveBlock` on drop, so pointer
and keyboard reordering cannot diverge.

`dragover`/`dragleave`/`drop` listen on the **mount** in the **capture** phase,
not on `view.dom`. The mount spans the gutter the handle lives in, so a drag
that never enters the text column still resolves a target; capturing there
means a claimed event is stopped before ProseMirror's own `view.dom` handlers
can fall back to the slice path. Events are only claimed while a drag is in
flight, so native text drags and file drops are untouched.

`dragleave` retracts the indicator, so a pointer that wanders off never leaves
a focus-coloured rule parked in the document until `dragend`. It retracts the
line only — the block is still on the pointer, so re-entering resolves a target
again and still drops. The event also fires for a crossing between two children
of the mount, which must not retract anything, so the handler asks
`relatedTarget` (the element being entered) whether the mount still contains
it, and falls back to testing the pointer against the mount's own box where the
browser leaves `relatedTarget` null, as Chromium does on drag events.

`blockAtPoint` clamps to the nearest block and carries no before/after bias, so
the hovered block's own midpoint — read from the `bottom` on the same rect the
scan already measured — decides which of its edges the block would land on.
That yields one of `childCount + 1` gaps, folded back onto `moveBlock`'s
pre-move index convention; both gaps bordering the source resolve to no move
and show no indicator. The scan skips every rendered child that owns no
top-level node — by category, not by class name: the drop indicator, a pending
`MlvEditorUploadPlaceholder`, an active gap cursor, and anything block-level
added later. `posAtDOM` alone cannot tell them apart, because a widget anchored
in a top-level gap maps to the perfectly valid index of the block beside it, so
the resolved index goes back through `view.nodeDOM` and only the element
ProseMirror actually rendered for that child may claim it. Pairing a block's
index with a widget's sliver of a box is what the check prevents: the midpoint
deciding the drop side would come from the wrong box, and the block would land
on the wrong side of its neighbour — silently, in one undo step.

A document change abandons the **whole** drag, not just the indicator. The
source index is a pre-move index exactly as the anchor is, and it is the one
deciding _which_ block moves: an insertion before it makes it name a different
block, so the indicator would repaint at the gap the user aimed at while the
drop silently reordered a block they never grabbed — one undo step, no error.
Both are dropped rather than mapped, because a source block that was itself
deleted has no mapped index.

The plugin carries no ProseMirror state at all. The drop indicator is a second
mount-owned element beside the handle, not a `Decoration.widget`: a widget at a
new position is a _different_ decoration, so ProseMirror destroys and rebuilds
its DOM on every move, and an element in normal flow has no `top` to
transition. Out in the mount it can glide, and it is further out of reach of
every serializer than a decoration ever was — the mount is a sibling of
`view.dom`, so the line is not part of the document in any sense. Escape
cancels the drag explicitly, independent of the `dragend` a real browser also
fires.

### Drag snapshot

`dragstart` measures every top-level block once into `{ index, top, bottom,
element }`, mount-relative and in the layer's unscaled space. Target
resolution, the indicator's `top`, the partition, and the settle's "before"
all read that array; none reads a live rect during the drag.

This is a correctness requirement, not an optimisation. The partition applies
`transform` to blocks, and a transform is reflected in
`getBoundingClientRect()`. Resolving the target from live rects after moving
them feeds the plugin's own output back into its input: the gap opens, the
pointer is now over a different block, the target changes, the gap moves —
oscillation on every pointer move. Two things follow for free: the drag
survives autoscroll, because only the mount's own rect is re-read per event;
and target resolution becomes a binary search, so `blockAtPoint`'s quadratic
scan is no longer paid per `dragover`. **The hover path still pays it** — the
follow-up remains open for that.

Carrying the element is what keeps the partition off `topLevelIndexOfDom`;
deciding per child whether it sits at or after the insertion point through the
index mapping would reintroduce the same quadratic walk on every target change.

### Ghost, partition, and settle

The drag image is a deep clone of the source element with every computed style
written into `style.cssText`, wrapped at `position: absolute; top: -10000px`
on `document.body` and handed to `setDragImage(wrapper, ltr ? 0 : width, 0)`.
Inlining the styles is what lets it render correctly where no `.mlv-editor`
ancestor exists; the technique is adapted from
`@tiptap/extension-drag-handle`'s `cloneElement`/`dragHandler`. That package is
deliberately **not** adopted: it exists to support nested drops through
`findBestDragTarget`/`scoring`/`edgeDetection`/`nodeRangeDrop`, which is the
behaviour this library excludes by design, and taking it would discard the
i18n, the `aria-hidden`/tab-order guarantees, and the zoom-scale conversion.

The editor's zoom rides on the wrapper as `zoom`, not `transform`: computed
styles are used values and never carry an ancestor's scale, and engines
rasterize a transformed drag image inconsistently, while `zoom` affects layout
so the wrapper's own box already reflects it when the browser measures. The
clone is taken **before** the source is dimmed, or the reduced opacity would be
baked into the image. A `dragstart` arriving while a wrapper is already
recorded removes it first; nothing else on `document.body` reaches it.

The partition writes `translateY(var(--mlv-editor-drop-gap))` inline on every
snapshot slot at or after the insertion point — the token, never a resolved
pixel value, so the stylesheet alone owns the distance. The transition lives on
`.ProseMirror--block-dragging > *`, a class present only while a drag is in
flight, because otherwise every layout change during ordinary typing would
animate. Inline styles are cleared on drop, `dragend`, Escape, and the
`enabled()` revocation.

The settle is a FLIP run once per drop through `Element.animate`, so nothing
forces a reflow between setting and clearing the offset and the animation
cleans itself up. Which block was where comes from the move's own permutation
rather than from matching elements to their old boxes: `moveBlock` deletes the
dragged node and reinserts it, so its element is not the one that was measured
and identity matching would silently skip the one block the user dragged. Only
the span between the two indices is walked. `prefers-reduced-motion` skips the
FLIP outright rather than running it at zero duration; the ghost still appears,
being a preview rather than motion.

`.mlv-editor__drop-indicator` is `--mlv-stroke-width-medium` thick in
`--mlv-border-focus` and absolutely positioned in the mount, so it contributes
no layout and the document below cannot jitter during a drag. The plugin sets
its `top` to the _pre-partition_ boundary between two blocks and the stylesheet
translates it half a gap down, so `--mlv-editor-drop-gap` never has to be
resolved into pixels in JavaScript. It hides under `@media print`, and its
`top` and opacity transitions collapse to `--mlv-duration-instant` under
`prefers-reduced-motion`.

## Tiptap peer dependencies

The published `@malva-ui/core` package declares these consumer-owned peer
dependencies and marks every one optional in `peerDependenciesMeta`, so
non-editor consumers do not receive irrelevant warnings. Applications using
the editor install the complete matching set. The root workspace pins every
package to `3.29.2`; the publish script rejects mismatched Tiptap versions
before replacing the shared placeholder.

- `@tiptap/core`
- `@tiptap/pm`
- `@tiptap/starter-kit`
- `@tiptap/markdown`
- `@tiptap/extension-list`
- `@tiptap/extension-text-style`
- `@tiptap/extension-highlight`
- `@tiptap/extension-text-align`
- `@tiptap/extension-table`
- `@tiptap/extension-image`
- `@tiptap/extension-file-handler`
- `@tiptap/extensions`

## Development

Run from the workspace root:

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx lint editor
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-serialization.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-extensions.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-toolbar.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-formatting-popovers.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-zoom.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-table.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-image-upload.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-status.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-a11y.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-ai-stream.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-ai-context.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-ai-menu.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx test editor --testFile=editor-ai-review-bar.spec.ts
NX_PREFER_NODE_STRIP_TYPES=false yarn nx build editor
```

`editor-serialization.spec.ts` covers nullable normalization, preservation of
structural markup, document-based semantic emptiness, HTML/Markdown/JSON
output, JSON document validation, order-independent JSON equivalence, and
recoverable serialization failures (including a real nonempty whitespace
Tiptap document whose Markdown serialization is blank).

`editor.spec.ts` additionally covers the JSON format end to end: document
round-trips with typed block/mark attributes, zero `valueChange` events for
external JSON that differs only by key order or whitespace, exactly one JSON
emission per user transaction, recoverable `parse` failures for malformed
JSON, non-document nodes, and node types outside the active extension set
(without truncating the document), nullable normalization of empty,
whitespace-only, and `null` JSON, and a `json → html → markdown → json` cycle
that preserves the document on one editor instance.

`editor-extensions.spec.ts` covers fresh arrays and instances from every
factory, the resolved default schema and marks, inactive/active file-handler
semantics, unique extension composition, finite temporary-upload progress, and
placeholder exclusion from every serialized representation.

`editor-block-handle.spec.ts` covers pre-move index semantics, single-undo-step
moves, selection retention inside the moved block (including atom nodes),
boundary and malformed-argument rejection, the `enabled` guard, the announced
move payload, dry-run capability checks, the `Alt+Shift+Arrow` keymap, unique
single inclusion of fresh handle instances in the default preset, and the
inert keymap of a literal extension set that omits the handle. It also covers
the plugin view: one non-focusable `aria-hidden` handle with a CSS-sized icon,
the zoom-scale conversion of the block offset, block resolution above the
first block, inside a block, in an inter-block gap, and below the last block,
the `enabled` guard on pointer moves, retraction through `update()` when the
editor stops accepting moves without any further pointer event,
listener/element teardown on destroy, and — through a real mounted
`MlvEditor` — that `mount()` returns the `.mlv-editor__view` layer and
`label()` reads `MlvEditorI18n.dragBlock`. jsdom has no layout engine, so the
geometry tests stub the rects the conversion reads; they verify index
resolution and the scale arithmetic, not browser hit-testing.

The drag lifecycle is covered from the same stubbed boxes: reordering down and
up on drop, the midpoint deciding which edge of one hovered block is used, both
gaps bordering the source resolving to no indicator and no move, a drop past
the last block still resolving once the indicator sits there, Escape cancelling
the drag and leaving a later drop inert, mid-drag revocation retracting the
indicator, a `docChanged` from elsewhere abandoning the whole drag so a
following drop moves nothing, `dragstart` refusing before any hover has written
`data-index`, exclusion of both affordances from all three serializers (that
one case builds the real default preset, since `getMarkdown()` needs a Markdown
manager `StarterKit` alone does not provide), and mount/`document` listener
pairing on destroy. Claim
versus pass-through is asserted through propagation rather than
`defaultPrevented`, which cannot discriminate — ProseMirror preventDefaults
every `dragover`. jsdom implements neither `DragEvent`/`DataTransfer` (a
`MouseEvent` carries every field these handlers read) nor
`Document.elementFromPoint`, which the dropcursor plugin reaches on any
unclaimed `dragover`; the file stubs the latter to return null.

The ghost and the motion are covered from the same stubbed boxes: the drag
image's off-screen wrapper, its `setDragImage` offsets, the inlined computed
styles on the clone, the clone being taken before the source is dimmed, removal
on `dragend` and on teardown, and no wrapper stranded by a second `dragstart`.
The oscillation guard is asserted by re-stubbing every block lower between two
`dragover` events at one pointer position and requiring the resolved gap not to
move — live rects would resolve a different one. The partition is asserted by
which children carry a transform and that every abort path clears them, and the
settle by the keyframes handed to a stubbed `Element.animate`, including that
`prefers-reduced-motion` produces none while the reorder still happens. That
last pair stubs `getBoundingClientRect` on `Element.prototype` rather than per
element, because `moveBlock` deletes and reinserts the dragged node and a spy
attached to the old element would never be asked.

A separate describe compiles `editor.scss` through Sass and pins the handle's
`inset-inline-start` expression, then checks its arithmetic against an
independent model of the centred column at all three `contentWidth` values, so
the handle cannot drift away from the text again. It also pins the drop
indicator's out-of-flow positioning and half-gap offset, the gap token, the
drag-in-flight scope of the partition transition, its reduced-motion entries,
the drag image's cap and top-left transform origin, and the print hide list.

`editor-toolbar.spec.ts` covers group order, labels, roving focus, active toggle
semantics, template replacement and extension points, plus readonly/disabled
mutation safety. `editor-zoom.spec.ts` covers the literal model API,
explicit-default and bidirectional clamped synchronization, strictly positive
custom presets, accessible popup keyboard/focus behavior, full-view safe-fit
geometry, serialization/selection/history invariants, localized responsive
overflow, custom-extension command omission, wide-recovery focus,
public-toolbar parity, SSR safety, and observer teardown.
`editor-formatting-popovers.spec.ts` covers editor-owned and standalone toolbar
parity for foreground, multicolour highlight, and link controls; selection and
composite-focus preservation; strict URL validation and custom protocol
intersection; reactive editor i18n; extension omission; readonly/disabled
safety; roving keyboard navigation; and public API typing.

`editor-table.spec.ts` covers the public table control in both toolbar shells;
its default and exact keyboard/pointer insertion dimensions; the complete real
row, column, merge, split, header, and delete command set; non-mutating
capability checks; extension omission; readonly/disabled guards; reactive
i18n; popup focus, Escape, and composite-blur ownership; and default resizable
table node-view geometry. It compiles the component SCSS through Sass and
loads it into a live CSSOM so selected-cell, resize-handle, and resize-cursor
theme rules remain regression-protected.

`editor-table-controls.spec.ts` covers the in-canvas grips: nothing paints
until the pointer enters a table, all three grips place against the hovered
cell, each menu runs its command against that cell rather than the caret, the
grips stay `aria-hidden` and out of the tab order, and a second editor on the
same page never answers for the first one's cells.
`editor-table-geometry.spec.ts` unit-tests the placement arithmetic in
isolation, including the unscaling of a zoomed layer.

`editor-image-upload-coordinator.spec.ts` and
`editor-image-upload.spec.ts` cover adapter precedence, all three sources,
validation, safe result URLs, progress, placeholders, cancellation, retry,
dialog focus and alternative-text rules, and replacement-extension omission.
`editor-status.spec.ts` covers count updates, limits, custom-extension
omission, and reusable status output. `editor-a11y.spec.ts`,
`editor-focus.spec.ts`, `editor-ssr.spec.ts`, and the binding matrix cover the
named textbox/composite widgets, disabled and readonly behavior, focus/blur,
server rendering, nullable values, and all four forms APIs.
`editor-a11y.spec.ts` additionally guards that the mounted block handle stays
`aria-hidden`, carries no `tabindex`, and leaves the composite at no more than
its two intended tab stops — the content textbox and the roving toolbar widget.

## Tested limitations

- Tiptap Markdown is still an upstream beta. Malva preserves nullable
  round-trips and the supported default schema, but does not promise
  byte-for-byte Markdown formatting or syntax outside that schema. Use
  `format="json"` when the stored representation must be lossless.
- JSON is validated against the active schema on every load. A stored document
  whose node types are no longer registered fails as a recoverable `parse`
  error and leaves the model untouched; it is never silently truncated. Keep
  the extension set that produced a document available to read it back.
- `extensions` is a literal replacement. Consumers must include Markdown,
  CharacterCount, image/file handling, table, and command extensions for each
  corresponding feature they expect; unavailable toolbar modules hide safely.
- Image upload is host-adapted and intentionally performs no network transport
  without an input or injected uploader. The default result URL policy permits
  absolute HTTP(S) URLs only.
- The AI toolkit is likewise host-adapted: without an `aiProvider` input or
  injected `MLV_EDITOR_AI_PROVIDER` no AI UI renders and no request is made.
  All three output modes are supported; a host save during `'reviewing'`
  serializes the accepted-by-default state — gate saves on
  `hasPendingSuggestions`.
- SSR exposes the shell and public signals but no usable `Editor` instance
  until browser initialization.
- Block reordering is top-level only. Blocks never reparent into lists or table
  cells, and list items and table rows are not individually draggable.
- Drag handles are hidden on touch devices and in print. The `Alt+Shift+Arrow`
  keymap remains the complete keyboard and assistive-technology path.
- The announced node type is the raw ProseMirror type name (`paragraph`,
  `heading`) and is not translated; localising it would need a key per node type
  in every locale pack.
