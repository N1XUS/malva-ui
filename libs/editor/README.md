# @malva-ui/editor

Rich-text editor for [Malva UI](https://www.npmjs.com/package/@malva-ui/core) — an SSR-safe Angular shell around a single browser-only [Tiptap](https://tiptap.dev) instance.

Ships as its own package so applications that never render an editor never pull in Tiptap: every `@tiptap/*` peer lives here, not in `@malva-ui/core`.

## Install

```bash
npm install @malva-ui/editor
```

Tiptap is a peer dependency set, so install it alongside:

```bash
npm install @tiptap/core @tiptap/pm @tiptap/starter-kit @tiptap/extensions @tiptap/markdown @tiptap/extension-file-handler @tiptap/extension-highlight @tiptap/extension-image @tiptap/extension-list @tiptap/extension-table @tiptap/extension-text-align @tiptap/extension-text-style
```

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

`@angular/cdk`, `@angular/common`, `@angular/core`, `@angular/forms`, `@lucide/angular`, `rxjs`, `@malva-ui/core`, `@malva-ui/cdk`, `@malva-ui/i18n`, and the twelve `@tiptap/*` packages listed above.

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
