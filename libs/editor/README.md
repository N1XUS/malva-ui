# @malva-ui/editor

Rich-text editor for [Malva UI](https://www.npmjs.com/package/@malva-ui/core) — an SSR-safe Angular shell around a single browser-only [Tiptap](https://tiptap.dev) instance.

Ships as its own package so applications that never render an editor never pull in Tiptap: every `@tiptap/*` peer lives here, not in `@malva-ui/core`.

## Install

```bash
npm install @malva-ui/editor
```

Tiptap, three ProseMirror packages and the Yjs collaboration stack are peer dependencies, so install them alongside. Tiptap must be **3.31 or later**, all thirteen packages on one version:

```bash
npm install @tiptap/core@^3.31 @tiptap/pm@^3.31 @tiptap/starter-kit@^3.31 @tiptap/extensions@^3.31 @tiptap/markdown@^3.31 @tiptap/extension-file-handler@^3.31 @tiptap/extension-highlight@^3.31 @tiptap/extension-image@^3.31 @tiptap/extension-list@^3.31 @tiptap/extension-table@^3.31 @tiptap/extension-text-align@^3.31 @tiptap/extension-text-style@^3.31 @tiptap/extension-collaboration@^3.31 prosemirror-view@^1.42.5 prosemirror-model@^1.25.12 prosemirror-state@^1.4.4 yjs@^13.6.33 y-protocols@^1.0.7 @tiptap/y-tiptap@^3.0.9
```

`prosemirror-view` ≥ 1.42.5 and `prosemirror-model` ≥ 1.25.12 are security floors (a paste XSS fix); 1.42.5 is the first view release that pairs with model ≥ 1.25.12. The install must resolve **exactly one copy of each**: a second, older `prosemirror-model` silently turns the fix off. Check with:

```bash
npm ls prosemirror-view prosemirror-model
```

The collaboration packages are imported only by `@malva-ui/editor/collaboration`, so an app that does not import that entry bundles none of them. `npm ls yjs prosemirror-state` must show one copy of each. Upgrading from a release without them: see the [collaboration peers migration](https://github.com/N1XUS/malva-ui/blob/main/docs/migrations/2026-09-editor-collaboration-peers.md).

Upgrading from Tiptap 3.29 or 3.30: see the [Tiptap 3.31 migration](https://github.com/N1XUS/malva-ui/blob/main/docs/migrations/2026-09-editor-tiptap-3-31.md).

## Quick start

```ts
import { MlvEditor } from '@malva-ui/editor';

@Component({ imports: [MlvEditor] })
export class ReleaseNotes {
  readonly value = signal<string | null>('<p>Hello</p>');
}
```

```html
<mlv-editor [(value)]="value" label="Release notes" ariaLabel="Release notes editor" />
```

## Value formats

`format` selects what the two-way `value` model holds:

| `format`     | `value` shape                   |
| ------------ | ------------------------------- |
| `'html'`     | HTML string (default)           |
| `'markdown'` | Markdown string                 |
| `'json'`     | Serialised Tiptap JSON document |

```html
<mlv-editor [(value)]="markdown" format="markdown" />
```

`value` is nullable — setting it to `null` clears the document.

## Features

- Composable extension presets, or pass your own via `extensions`
- Replaceable command toolbar
- Image uploads with an upload-placeholder extension
- Block drag reordering via a block handle
- Server-side rendering safe: Tiptap is only constructed in the browser

## AI toolkit

`@malva-ui/editor/ai` adds an optional AI surface — an action menu, a streaming transform contract, and an inline suggestion/review bar with word-level diffs:

```ts
import { MlvEditorAiMenu, MLV_EDITOR_AI_CONTEXT } from '@malva-ui/editor/ai';
```

You supply the model call; the package owns the editing UX around it.

## Peer dependencies

`@angular/cdk`, `@angular/common`, `@angular/core`, `@angular/forms`, `@lucide/angular`, `rxjs`, `@malva-ui/core`, `@malva-ui/cdk`, `@malva-ui/i18n`, the thirteen `@tiptap/*` packages listed above (`^3.31.0`), `prosemirror-view` (`^1.42.5`), `prosemirror-model` (`^1.25.12`), `prosemirror-state` (`^1.4.4`), `yjs` (`^13.6.33`), `y-protocols` (`^1.0.7`) and `@tiptap/y-tiptap` (`^3.0.9`).

## Related packages

- [`@malva-ui/core`](https://www.npmjs.com/package/@malva-ui/core) — the component library
- [`@malva-ui/cdk`](https://www.npmjs.com/package/@malva-ui/cdk) — headless primitives
- [`@malva-ui/i18n`](https://www.npmjs.com/package/@malva-ui/i18n) — localisation

## Versioning and support

Semver contract, what counts as public API, the deprecation window and the
support window per major:
[VERSIONING.md](https://github.com/N1XUS/malva-ui/blob/main/VERSIONING.md)
(the repository is private while the library is pre-1.0, so the link needs
repository access — ask us for the policy if it 404s for you).

## License

MIT
