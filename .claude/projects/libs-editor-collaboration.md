# Library: editor collaboration (`@malva-ui/editor/collaboration`)

> **Keep this file up to date.** Always update this file whenever you change the collaboration entry point, its public API, the primary entry's collaboration contract, or the Yjs peer wiring. The primary entry is documented in `.claude/projects/libs-editor.md`.

## Overview

Real-time co-editing of one `mlv-editor` through a **host-implemented transport**. Yjs CRDT, y-websocket wire protocol, `@tiptap/extension-collaboration` + `@tiptap/y-tiptap` binding. Docs route `/editor-collaboration`. Migration: `docs/migrations/2026-09-editor-collaboration-peers.md`. Design: `docs/superpowers/specs/2026-09-28-editor-f-collaboration-design.md` (F-D1…F-D25, D-F8, D-F9).

## Boundary (F-D1)

- Implementation lives only in the secondary entry `libs/editor/collaboration/`. The primary entry holds a Yjs-free `@internal` contract: `MLV_EDITOR_COLLABORATION` (`editor/editor-collaboration.contract.ts`), provided by the directive, injected optionally by `MlvEditor`.
- The collaboration packages are **required peers** of every install, but only the secondary entry imports them: a bundle that does not import it carries no Yjs code. Pinned by `src/lib/editor-collaboration-boundary.spec.ts` (walks the primary entry's relative-import graph; fails on `yjs`, `y-protocols`, `lib0`, `@tiptap/y-tiptap`, `@tiptap/extension-collaboration`, `@malva-ui/editor/collaboration`).
- The secondary barrel is `export *` from **public-only modules**; `@internal` helpers (session, binder, schema guard, anchors, frame / metadata constants, palette helpers) live in modules it never names. Pinned by `collaboration-barrel.spec.ts` (an exported `@internal` symbol in a listed module, or an unlisted module, fails).

## `MlvEditorCollaboration` (from `@malva-ui/editor/collaboration`)

`mlv-editor[mlvEditorCollaboration]`, `exportAs: 'mlvEditorCollaboration'`.

| Input                         | Type                                 | Default     | Notes                                                                                      |
| ----------------------------- | ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------ |
| `mlvEditorCollaboration`      | `MlvEditorCollaborationTransport`    | required    | Read once.                                                                                 |
| `collaborationDocumentId`     | `string`                             | required    | Passed to the transport. Read once.                                                        |
| `collaborationUser`           | `MlvEditorCollaborationUser \| null` | `null`      | Live. Anonymous name when unset.                                                           |
| `collaborationInitialContent` | `string \| null`                     | `null`      | Client fallback seed, in the editor's `format`; applied only to an empty, unseeded doc.    |
| `collaborationDocument`       | `Y.Doc \| null`                      | `null`      | Host-owned doc (e.g. `y-indexeddb`). Exclusive to this editor, never destroyed. Read once. |
| `collaborationField`          | `string`                             | `'default'` | Shared fragment name. Read once.                                                           |
| `collaborationSyncTimeout`    | `number`                             | `10000`     | ms to the first sync before `offline` + `editorReady`.                                     |

- Outputs: `collaborationStatusChange` (`MlvEditorCollaborationStatus`), `collaborationPeersChange` (`readonly MlvEditorCollaborationPeer[]`).
- Signals: `status`, `peers` (remote only, client-id order), `self`, `synced`, `hasSynced`, `hasUnsyncedChanges`, `document` (the `Y.Doc`, `null` on the server).
- Read-once inputs changed later: one recoverable `configuration` error, session kept. Switch documents by re-creating the editor (`@for … track documentId`).
- Statuses: `idle` (server / before attach) → `connecting` → `syncing` → `synced`; `offline` (disconnected or first-sync timeout); terminal `closed` (transport completed) and `failed` (transport error, or schema rejection, D-F9).

## Transport contract (F-D3, F-D4)

- `abstract class MlvEditorCollaborationTransport { relay = false; connect(context): Observable<event> }`. The library encodes/decodes every frame (y-websocket protocol: sync, awareness, auth, query-awareness); the host only moves bytes and owns auth, reconnection and backoff.
- Emit `{ type: 'connection', state }` on link changes and `{ type: 'message', data }` per inbound frame, in order. Send every value of `context.outbound` (hot; emits only while last reported `connected`; frames produced while not connected are dropped and re-derived by the next handshake).
- **Subscribe to `outbound` before emitting `connected`.** The handshake is sent synchronously on `connected`; a synchronous transport that reports it first (`BroadcastChannel`, an in-page relay) loses it and never syncs. Both docs examples shipped that bug until the e2e caught it.
- Transient drop → `disconnected`. `error` is terminal (`failed`, read-only). `complete` ends the session (`closed`). Unsubscribing is the host's signal to close.
- `relay = true` for a far end with no Yjs state (BroadcastChannel, pub/sub fan-out): the client pushes full state on every `connected`.
- Text transports: `encodeMlvEditorCollaborationFrame` / `decodeMlvEditorCollaborationFrame` (base64); `mlvEditorCollaborationFrameType` reads a frame's type.
- **Awareness clock 0:** y-protocols never applies a remote awareness state whose clock is 0. A transport or relay that replays a fresh local state without bumping its clock produces a peer that never appears. Forward awareness frames as received; never synthesise them.
- A frame that arrives synchronously inside `subscribe` is handled; a session that fails there still unsubscribes (pinned in `collaboration-session.spec.ts`).

## Editor behaviour while collaborating

- **Write gate (F-D7):** editable only once synced, or when the doc already carried the seed flag, and never after `failed` / `closed`. While closed: `.mlv-editor--syncing` + `aria-busy` until the first sync or timeout. `editorReady` fires once, at first sync, timeout or a terminal status. `clearValue()` honours the gate.
- **`value` is an output-only mirror (F-D8):** local changes write synchronously; remote changes coalesce into one trailing write per 100 ms. External writes are never applied: ignored before the gate first opened, then the first per instance emits a recoverable `collaboration` error and the model is set back.
- **`origin` (F-D9):** `'remote'` for a change-origin transaction (peer update, seed, first render); a local Y undo/redo is `'local'`. A remote transaction is one whole-document `ReplaceStep`.
- **Undo (F-D10):** per-user `Y.UndoManager`; StarterKit `undoRedo` is dropped by the preset. Toolbar Undo/Redo follow undo-stack events (`undoRevision`), not only transactions.
- **`characterLimit` (F-D11):** `CharacterCount` counts with no limit; `MlvEditorCollaborationCharacterLimit` re-applies the limit to local transactions only. Remote overflow is accepted; local growth blocks until back under.
- **Preset:** `mlvEditorDefaultExtensions({ collaboration: { isChangeOrigin } })`. Without the option the output is byte-identical (`editor/editor-collaboration-parity.spec.ts`). A custom set that keeps `undoRedo` or a limited `CharacterCount` fails preflight with a non-recoverable `configuration` error.
- **N1 (F-D16):** block IDs never mint or dedupe on change-origin transactions and are assigned by `ensureBlockIds()` after the first sync; heading anchors skip change-origin transactions.
- **Positions (F-D12, D-F8):** `MlvEditorPositionTracker` (appended after the binding, priority below `collaboration`, so its view recaptures anchors after ySync pushed a local change). A tracked position is **lost** (`null`) with the same rule as the local path (`mapResult(pos, -1).deleted`): the anchor's left token deleted, or its type or an ancestor deleted. Two measured edges differ: see `libs-editor.md` § _Tested limitations_.
- **SSR (F-D21):** on the server the directive creates nothing (no session, `Y.Doc`, awareness timer, connection); the shell renders as without it.

## Schema safety (F-D22, D-F9)

- y-tiptap 3.0.9 **deletes** a Y item it cannot render with the local schema (y-tiptap.js L968-974, L1004-1008), for every peer. Malva therefore validates first: `MlvEditorCollaborationSchemaGuard` listens to the doc's `beforeObserverCalls` (before y-tiptap's deep observer) and checks each changed container (node names, content expression, text marks) and each new or re-attributed element (declared attributes, `type.create`), in time proportional to the change. The binding's own pushes are skipped.
- On a mismatch: guard disposed, ySync binding muted and destroyed in the same cleanup, undo stack cleared, status `failed`, one `{ code: 'collaboration', recoverable: false }` error, gate closed, transport unsubscribed. Nothing is deleted locally or sent; the host `Y.Doc` is never destroyed.
- A host `collaborationDocument` that already holds content is checked whole before the binding renders it; on a mismatch the session never connects.
- Incomplete content ends (a required child missing) are not rejected: every new doc starts empty and concurrent deletions leave them. Tiptap's content check (`enableContentCheck` → `filterInvalidContent`) still reports deeper `doc.check()` failures as `collaboration` (F-D22), and that path also cuts the binding.
- **Every client must run the same extension set.** An older client meeting newer content fails closed instead of erasing it; roll out extension changes before content uses them.

## Presence — `MlvEditorPresence` (F-D17)

`mlv-editor-presence`, from `@malva-ui/editor/collaboration`. Host `role="group"`, named by `collaborationPresenceLabel`; modifiers `--offline` / `--failed` / `--closed`.

| Input           | Type                     | Default  | Notes                                                    |
| --------------- | ------------------------ | -------- | -------------------------------------------------------- |
| `collaboration` | `MlvEditorCollaboration` | required | The directive, via `#c="mlvEditorCollaboration"`.        |
| `showStatus`    | `boolean`                | `true`   | Renders the status line (`mlv-status-indicator` + text). |

- Renders nothing inside while `idle` (server, before attach): the named group only.
- `__peers`: a visually hidden ICU count (`collaborationPeers`) plus `mlv-avatar-group size="s"` of the remote peers — initials from `deriveInitials`, background `mlvEditorCollaborationTint(color)` (75% toward white, initials ≥ 8:1 on it), a viewer named `collaborationViewing`.
- `__status` / `__status-text`: `connecting` / `syncing` / `offline` warning tone, `synced` success, `closed` / `failed` danger; `--offline` text `--mlv-text-warning`, `--failed` / `--closed` `--mlv-text-negative`.
- Place it in `mlvEditorStatus` or a page header, **not** a toolbar slot: a readonly editor renders no toolbar (#498).
- No full-colour peer ring and no `--mlv-editor-presence-peer-color`: `mlv-avatar-group` exposes no per-member hook (follow-up). `mlv-avatar-group` tracks by `name`, so two peers with the same name raise NG0955 (follow-up).

## Peer identity and colours (F-D18, F-D19)

- Awareness is validated on receipt (`readMlvEditorCollaborationPeer`): name trimmed and capped, else `collaborationAnonymous`; colour must be `#rrggbb`, else a `MLV_EDITOR_COLLABORATION_COLORS` entry picked by FNV-1a of the user id, else the name. Every palette entry holds ≥ 3:1 on `#fafafa` / `#ffffff` (light) and `#171717` / `#333333` (dark); a consumer colour is used as given (1.4.11 is the host's job). The label foreground (`mlvEditorCollaborationLabelColor`, black or white) holds ≥ 4.58:1 on any colour.
- `mode`: `viewing` while the peer's editor is readonly, disabled, unsynced or failed; else `editing`.

## Remote carets (F-D18)

- `createMlvEditorCollaborationCarets` wraps y-tiptap's `yCursorPlugin` with the validated awareness (y-tiptap otherwise mutates `aw.user` defaults) and skips viewing peers.
- `span.mlv-editor__caret` (`aria-hidden`, `border-inline-start` in `--mlv-editor-caret-color`) with `span.mlv-editor__caret-label` (name, `--mlv-editor-caret-label-color`); `mlv-editor__caret-selection` inline decoration at 25% `color-mix`. The two custom properties are set inline per peer — not an override point.
- The label sits above the caret and flips below on the first block (`.mlv-editor__content .ProseMirror > :first-child .mlv-editor__caret-label`). Forced colours: caret `CanvasText`, label `CanvasText` on `Canvas`, selection underlined. Print hides carets and selections.
- y-tiptap batches awareness repaints on `timeout(0)`: a spec waits a macrotask after an awareness sync before asserting carets.

## Readonly, disabled, AI and images (F-D15, F-D20, F-D23)

- **Readonly / disabled:** the session stays connected and receiving; `self.mode` becomes `viewing` (peers see it, no caret is drawn for it); edits resume on the flip back.
- **Announcements:** through the editor's live announcer — `collaborationOffline` (only after a sync), `collaborationBackOnline`, `collaborationSyncTimeout` (once), `collaborationClosed`, `collaborationFailed`.
- **AI guard:** `mlvEditorCollaborationBlocksAi(editor)` (`@internal`, primary-entry contract) — `MlvEditorAiMenu` items disabled, `MlvEditorAiContext.start` reports a recoverable `configuration` error, `mlvEditorAiStream` returns the settled write-free handle. The engine streams interim chunks into the document and restores it whole, which peers would receive.
- **Remote images:** a collaborating preset uses `policedImage(imageUrlPolicy)`, a node view that withholds a refused `src` from the **editing DOM only**: that `<img>` renders with no `src` (never fetched), marked `data-mlv-editor-image-blocked`, and the resizable view does not hide it, so its `alt` shows. `renderHTML` is untouched, so the shared document, `getHTML()`, `value` and the clipboard keep every `src`: cutting and pasting a refused image leaves it, source included, in the shared document on every peer. A later remote change to `src` is re-checked; with `resize.enabled: false` the plain view is policed the same way.
- **Policy input:** `mlv-editor` resolves each `src` against the injected document's `baseURI` (`new URL(src, baseURI)`; unparsable → refused) and applies `imageUploadOptions.urlPolicy` (default `mlvEditorDefaultImageUrlPolicy`) to the **absolute href** the browser would fetch. A relative same-origin image therefore renders; scheme and credential checks still apply. The upload coordinator calls the same policy with the uploader's raw `src`, so a host policy must parse (`new URL(url)`), not prefix-match a raw path. A policy that throws refuses: the image renders blocked (`imageSourceAllowed` catches — a throw inside node-view creation aborted the view update, dropping the image and every later node from the DOM while state stayed intact). Consumer-supplied extension arrays are not policed (follow-up).
- **Uploads (F-D13):** placeholders are rebuilt from tracked positions after change-origin transactions (a remote transaction replaces the whole document, so mapped widgets would all drop).
- **Block drag (F-D14):** a peer's edit during a drag re-finds the block through its tracked start; intact → the drag continues with fresh geometry, deleted or changed → cancelled and `collaborationMoveCancelled` announced.

## i18n

- Thirteen optional `MlvEditorI18n` keys (`collaborationConnecting` … `collaborationSyncTimeout`) in all 14 packs; `injectMlvEditorCollaborationMessages` falls back to English per key. `collaborationMoveCancelled` is read by the core editor, with its fallback in the internal `MLV_EDITOR_COLLABORATION_MOVE_CANCELLED_FALLBACK` (`editor/editor-collaboration.contract.ts`), not in `OPTIONAL_MESSAGE_FALLBACKS`. A blank pack value counts as missing at both sites. `collaboration-messages.spec.ts` pins all thirteen fallbacks equal to the English pack.

## Seeding (F-D6)

- `createMlvEditorCollaborationSeed(content, { schema, field? })`: deterministic update (client id hashed from field + canonical content, deterministic block IDs, `mlv-editor.seeded` flag). Runs without a DOM; apply with `Y.applyUpdate` on the server before admitting clients. Build `schema` with `getSchema(mlvEditorDefaultExtensions({ format }))`.
- Client fallback: `collaborationInitialContent`, applied through the same function when the first sync finds the doc empty and unseeded.

## Testing notes

- `testing/memory-relay.ts` (`MemoryCollaborationHub`, server-backed or relay) and `testing/collaboration-harness.ts` (`CollaborationRig`, `configureCollaborationTestBed`, `tiptap()`); spec-only, not exported.
- `collaboration-schema-guard.spec.ts` pins the Yjs `beforeObserverCalls` contract, the rejection rows (a new marked block, a mark on text the peer already had — only the `XmlText` → parent branch sees it — a node, an attribute, a node or mark attribute named `constructor`, a disallowed child) with server/peer state vectors and content, the pre-bind check and a concurrent-deletion non-regression.
- `collaboration-performance.spec.ts` (U8): 2,000 blocks, one remote keystroke. No wall-clock threshold (it runs in the parallel unit suite): Malva's median overhead must stay under a fifth of the median total, measured in the same run (about 1:200; R1 in jsdom: overhead about 0.05 ms p95 of a p95 total of about 12 ms).
- `collaboration-seed.node.spec.ts` runs in the `node` environment; `scripts/testing/setup-assert-zoneless.js` skips its pin there.
- Phase B specs: `collaboration-carets.spec.ts` / `-carets-styles.spec.ts`, `editor-presence.spec.ts` (every status, axe), `collaboration-readonly.spec.ts`, `-announcements`, `-block-drag`, `-upload-placeholder`, `-ai-guard`, `-image-policy`, `-colors`, `-barrel`. TestBed keeps only the latest root in the document: re-append an earlier fixture's host before an axe sweep of it.
- E2e: `libs/editor/e2e/editor-collaboration.spec.ts` — two pages of one context on `/editor-collaboration` example 2 (BroadcastChannel): converge, one seed, presence, a named `aria-hidden` caret.
