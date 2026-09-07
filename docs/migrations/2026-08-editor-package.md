# `@malva-ui/core/editor` → `@malva-ui/editor`

Date: 2026-08-01.

The editor is now its own published package rather than a secondary entry point
of `@malva-ui/core`. There is no deprecated alias — `@malva-ui/core/editor` no
longer resolves, and `@malva-ui/core`'s root barrel no longer re-exports it.

## What consumers change

1. Install the new package alongside core:

   ```bash
   npm install @malva-ui/editor
   ```

2. Rewrite the import specifier. Every exported symbol keeps its name:

   ```diff
   -import { MlvEditor, MlvEditorToolbar } from '@malva-ui/core/editor';
   +import { MlvEditor, MlvEditorToolbar } from '@malva-ui/editor';
   ```

   Deep imports of individual editor symbols from the `@malva-ui/core` root
   barrel also stop resolving:

   ```diff
   -import { MlvEditor } from '@malva-ui/core';
   +import { MlvEditor } from '@malva-ui/editor';
   ```

3. Nothing else. No class, type, input, output, token, or CSS class name
   changed, and the component's behaviour is identical.

## Why

The editor was the only part of `@malva-ui/core` that dragged eleven optional
`@tiptap/*` peer dependencies into the package manifest. They were marked
optional in `peerDependenciesMeta` precisely so that consumers who never touch
the editor would not be warned about them — a workaround for a packaging
decision rather than a property anyone wanted.

Splitting the package removes the problem instead of muting it. Core now
declares **no** Tiptap peers and no `peerDependenciesMeta` block at all, and the
Tiptap set is a plain required peer group of `@malva-ui/editor`, where it is
genuinely required.

The dependency direction made this clean: the editor composes core's button,
dialog, popup, input, menu, toolbar and colour-picker surfaces, but nothing in
core ever imported the editor apart from the single re-export line in its root
barrel. `@malva-ui/editor` therefore peer-depends on `@malva-ui/core`, and the
Nx boundary rules now enforce that direction — `family:core` cannot reach
`family:editor`, so the split cannot silently regrow into a cycle.

## Workspace-internal changes

Relevant only to contributors:

- Source moved `libs/core/editor` → `libs/editor`.
- The Nx project is renamed `core-editor` → `editor`, so commands become
  `nx lint editor`, `nx test editor`, `nx build editor`.
- `libs/editor` gains a package root (`package.json`, `ng-package.json`,
  `tsconfig.lib.prod.json`) and a `build` target; it previously had none,
  because ng-packagr built it as part of core.
- `scripts/publish.mjs` publishes it after core, which it peer-depends on.
- The project is tagged `family:editor`.
