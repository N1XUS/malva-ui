---
name: verbose build flag
description: Use --verbose when building libs to surface detailed error messages
type: feedback
---

Always use `yarn nx run <lib-name>:build --verbose` when a build fails to surface detailed errors (e.g. incorrect SCSS mixin import paths that are silently swallowed otherwise).

**Why:** A data-table build failure was silently showing "SyntaxError: Unexpected end of JSON input" from ng-packagr/esbuild. The root cause was an incorrect SCSS `@use` import path for mixins, which was only revealed after adding `--verbose`.

**How to apply:** Whenever `yarn nx build <lib>` fails with a cryptic error, re-run with `yarn nx run <lib>:build --verbose` to get the full error stack and file location.