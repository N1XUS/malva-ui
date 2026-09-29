# `@malva-ui/editor` gains real-time collaboration and its peers

Date: 2026-09-29. Issue: [#515](https://github.com/N1XUS/malva-ui/issues/515).

## Summary and classification

- **Breaking — peers, plus two type widenings.** `feat(editor)!`; on the `0.x`
  line `!` releases as the next minor (VERSIONING §7).
- New secondary entry point **`@malva-ui/editor/collaboration`**:
  `MlvEditorCollaboration` (`mlv-editor[mlvEditorCollaboration]`), the host
  transport contract `MlvEditorCollaborationTransport`, frame helpers, and the
  server seed builder `createMlvEditorCollaborationSeed`. Additive.
- Why major:
  - **Every `@malva-ui/editor` install gains required peers** (VERSIONING §2:
    `peerDependencies` are public; §3: a peer that was absent and is now
    required narrows the installable set). Precedents:
    [2026-09-core-router-peer.md](2026-09-core-router-peer.md),
    [2026-09-editor-tiptap-3-31.md](2026-09-editor-tiptap-3-31.md).
  - `MlvEditorTransactionEvent` gains a **required** `origin` member: code
    constructing the payload no longer compiles.
  - `MlvEditorErrorCode` gains `'collaboration'`: an exhaustive `switch` no
    longer compiles.
- Minor-class additions riding along:
  - the entry point and its symbols, including the presence component
    `MlvEditorPresence` (`mlv-editor-presence`);
  - BEM: modifiers `mlv-editor--collaborative` / `mlv-editor--syncing`,
    elements `mlv-editor__caret` / `__caret-label` / `__caret-selection`, and
    the `mlv-editor-presence` block (`__peers`, `__status`,
    `__status-text`; `--offline` / `--failed` / `--closed`);
  - preset options `collaboration` (`MlvEditorPresetCollaborationOptions`) and
    `imageUrlPolicy`;
  - the exported type `MlvEditorTransactionOrigin`;
  - thirteen **optional** `MlvEditorI18n` keys (`collaboration*`), declared
    in all 14 packs with an English fallback (VERSIONING §3 row 115).
- Docs: new route `/editor-collaboration` (split view over an in-page relay;
  a cross-tab `BroadcastChannel` transport).

## Who is affected: every `@malva-ui/editor` install

| Peer                              | Range      | Why                                                                         |
| --------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `yjs`                             | `^13.6.33` | CRDT. One copy per app: two copies break `instanceof` and sync silently.    |
| `y-protocols`                     | `^1.0.7`   | Sync and awareness protocols (y-websocket wire format).                     |
| `@tiptap/y-tiptap`                | `^3.0.9`   | ProseMirror ↔ Yjs binding. Literal floor: widening `3.0.9` gives `^3.0.0`. |
| `@tiptap/extension-collaboration` | `^3.31.0`  | Tiptap's collaboration extension; same version as the other `@tiptap/*`.    |
| `prosemirror-state`               | `^1.4.4`   | Must be the one copy `@tiptap/pm` resolves, or plugin keys stop matching.   |

`lib0` (`^0.2.100`) is a `dependencies` entry: npm installs it with the package.

**Do:**

```bash
npm i yjs@^13.6.33 y-protocols@^1.0.7 @tiptap/y-tiptap@^3.0.9 @tiptap/extension-collaboration@^3.31 prosemirror-state@^1.4.4
npm ls yjs prosemirror-state   # exactly one copy of each
```

- npm 7+ and pnpm 8+ install missing peers themselves; verify one
  `prosemirror-state` anyway. Yarn Berry installs no peers: add them by hand,
  then `yarn dedupe yjs lib0 prosemirror-state`.
- `ERESOLVE` on install means an app already pins an older copy: raise it to the
  range above.

## Bundle impact: none unless you import the collaboration entry

- The primary entry `@malva-ui/editor` imports no collaboration package. A
  build that does not import `@malva-ui/editor/collaboration` bundles no Yjs
  code; the peers are only installed. Pinned by
  `libs/editor/src/lib/editor-collaboration-boundary.spec.ts`.
- **Verify:** search the built chunks for `yjs` (or run a source-map explorer);
  only a lazy chunk that imports the collaboration entry should contain it.

## Code constructing `MlvEditorTransactionEvent`

Typically spec fakes of the `(transaction)` output payload.

**Do:** add `origin: 'local'`. Without collaboration every real transaction
carries `'local'`; `'remote'` means applied from the shared document.

## Exhaustive `switch` on `MlvEditorErrorCode`

**Do:** add a `'collaboration'` branch. It reports a session failure (transport
error or completion, first-sync timeout, schema rejection, an undecodable
frame) and, recoverable, an external `value` write ignored while collaborating.

## Custom extension sets used with collaboration

A consumer `[extensions]` array on a collaborating editor must not carry a
second undo system or a transaction-cancelling limit. Preflight otherwise fails
with a non-recoverable `configuration` error and the editor is not created.

**Do** one of:

- build the set with the preset factories and pass
  `collaboration: { isChangeOrigin }` (from `@tiptap/extension-collaboration`);
- or configure StarterKit with `undoRedo: false` and `CharacterCount` without
  a `limit` (use the editor's `characterLimit`, applied to local input only).

## Mixed extension sets: fail closed

- `@tiptap/y-tiptap` 3.0.9 deletes, **for every peer**, a shared node, mark or
  attribute the local schema cannot render. Malva validates remote content
  first: a client meeting content its extensions do not know goes `failed`
  (read-only, one non-recoverable `collaboration` error, transport
  unsubscribed) and deletes nothing. A host `collaborationDocument` that already
  holds such content is refused before it renders.
- **Do:** run the same extension set on every client of a document. Roll out a
  new extension (or a newer app version adding one) to every client before
  content uses it; an older client left open fails closed instead of erasing
  the new content.

## Behaviour while collaborating (new surface, no action for existing code)

- **Transport ordering.** `context.outbound` is hot and the handshake is
  sent synchronously on `connected`. **Do:** subscribe to `outbound` before
  emitting `connected`; a transport that reports it first (a
  `BroadcastChannel`, an in-page relay) loses the handshake and never syncs.
- **Presence.** `MlvEditorCollaboration.peers` / `self` / `status` are
  signals; `mlv-editor-presence` renders them (avatars, a visually hidden
  count, the status line). Place it in `mlvEditorStatus` or a page header:
  a readonly editor renders no toolbar. Peers are named from validated
  awareness — a trimmed, capped name and a `#rrggbb` colour, else the
  palette `MLV_EDITOR_COLLABORATION_COLORS` — and reach the DOM only as text
  or a custom property.
- **Remote carets.** `aria-hidden` widgets (`mlv-editor__caret` with a name
  label, `mlv-editor__caret-selection` for a range) in the peer's colour;
  the label flips below the caret on the first line; forced colours paint
  `CanvasText`; print hides them. Viewing peers draw none.
- **Readonly / disabled.** The session stays connected and keeps receiving;
  the local user becomes `viewing` to peers, and edits resume on the flip
  back.
- **Announcements.** Through the editor's live announcer: offline (only after
  a sync), back online, the first-sync timeout, closed, failed.
- **AI.** Every `@malva-ui/editor` AI entry point refuses a collaborating
  editor: menu items disabled, `start` reports a `configuration` error, the
  stream handle is settled and writes nothing. The current engine streams
  interim chunks into the document, which peers would receive and see
  reverted.
- **Images from peers.** A peer's image bypasses the upload coordinator, so a
  collaborating editor fetches an image only when its source passes
  `imageUploadOptions.urlPolicy` (default `mlvEditorDefaultImageUrlPolicy`).
  The source is first resolved against the document's `baseURI` and the policy
  judges that absolute URL, so a relative same-origin image still renders. A
  refused image is withheld from the **editing view only**: its `<img>` has no
  source, carries `data-mlv-editor-image-blocked` and shows its `alt`. The
  shared document, `getHTML()`, `value` and the clipboard keep the source,
  so cutting and pasting such an image loses nothing for any peer. The
  policy now sees two shapes of URL: the upload path still passes the
  uploader's `src` as returned (possibly relative), the collaborating view
  the resolved absolute href. **Do:** parse the argument with
  `new URL(url)` and judge its parts; never prefix-match a raw path — a
  policy like `url => url.startsWith('/uploads/')` accepts uploads, then
  blocks every image, the user's own included, once collaboration is on. A
  policy that throws refuses on both paths.
- **Uploads and block drag.** Upload placeholders track their position through
  remote edits. A peer's edit during a block drag re-finds the dragged block:
  the drag continues when the block is intact, and is cancelled and announced
  when it was deleted or changed.
- **Security.** Nothing here authenticates: who may join a document, and with
  which rights, is the transport's decision. Viewing mode is a local UI state,
  not an access control.

## Unchanged

- Everything for editors without `mlvEditorCollaboration`: the preset output is
  byte-identical without its `collaboration` option, `value` is emitted
  synchronously as before, every transaction's `origin` is `'local'`, and no
  collaboration extension is mounted (pinned by
  `libs/editor/src/lib/editor/editor-collaboration-parity.spec.ts`).
- No selector, input, output, BEM class or i18n key of `mlv-editor` and the
  toolbar is renamed, removed or retyped; the additions above are optional.
