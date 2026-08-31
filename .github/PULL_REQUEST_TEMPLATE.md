## What does this change?

<!-- The user-visible effect, not a restatement of the diff. -->

## Why?

<!-- Link the issue if there is one. -->

## Checklist

- [ ] `yarn nx run-many -t lint test typecheck` is clean
- [ ] Conventional commit messages, with a scope from `commitlint.config.mjs`
- [ ] The library's `CLAUDE.md` is updated if the public API changed, and `yarn nx run docs:check-doc-api` passes
- [ ] New or changed interactive UI is keyboard-operable and AXE-clean
- [ ] Breaking changes are documented under `docs/migrations/`
