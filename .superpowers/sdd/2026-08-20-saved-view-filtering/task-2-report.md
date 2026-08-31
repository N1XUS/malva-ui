# Task 2 report — saved-view state contracts

## Scope

Added the public, generic saved-view state contracts and the host-normalized
state comparison helper for `@malva-ui/core/view-variant`. No component or
persistence behavior was added.

## RED

Added `view-variant-state.spec.ts` before either production source file.

Ran:

```sh
yarn nx test core-view-variant --skipNxCache
```

The focused suite collected three tests and failed the two equality tests as
expected with `TypeError: mlvViewStateEqual is not a function`. The immutable
contract fixture collected successfully, confirming the test targeted the
empty public barrel rather than a test-discovery error.

## GREEN

Added:

- `view-variant.types.ts` with the exact scope, action, capabilities, variant,
  create-request, busy-action, and group-label contracts.
- `view-variant-state.ts` with `mlvViewStateEqual()`, implemented exactly as
  host-normalized `JSON.stringify()` equality.
- Public barrel exports for both modules.

The helper JSDoc records its deliberately narrow contract: the host normalizer
must remove transient values and supply stable object-key and array order; the
helper neither performs generic deep equality nor reorders values itself.

## Verification

Passed:

```sh
yarn nx test core-view-variant --skipNxCache
yarn nx typecheck core-view-variant --skipNxCache
yarn tsc --noEmit -p libs/core/view-variant/tsconfig.spec.json
yarn nx lint core-view-variant --skipNxCache
yarn nx typecheck core --skipNxCache
yarn nx build core --skipNxCache
```

The focused suite passed 3/3 tests. The direct spec-project TypeScript check
verifies the `@ts-expect-error` readonly/create-scope assertions, because the
inferred Nx leaf typecheck deliberately uses `tsconfig.lib.json` and excludes
spec files. The grouped build compiled the `@malva-ui/core/view-variant`
secondary entry point successfully.

Public-surface guards confirmed every requested identifier in source and the
built `.d.ts` files, and confirmed the former `greeting`/empty-barrel
placeholder is absent. `git diff --check` passed after staging the scoped
files.

## Self-review

- All public interface fields are `readonly`, including nested capability,
  create-request, busy-action, and label contracts.
- `MlvViewVariantCreateRequest` excludes the `system` scope at the type level.
- Tests import through the public barrel, cover host-supplied normalization,
  meaningful changes, public contract construction, and compile-time
  immutability.
- No transient state, generic deep-equality behavior, normalization reordering,
  component behavior, or persistence policy was introduced.

## Concerns

The normalizer contract is intentionally strict: a host that returns unstable
object-key or array order can receive a false dirty-state result. This is the
documented plan ruling, not behavior for this helper to correct internally.

## Fix Round 1 — independent create-scope guard and API documentation

The original `request.scope = 'system'` negative assertion could be satisfied
solely by `readonly`, without proving that a mutable create-request scope still
excludes `system`. It now remains as a separate readonly mutation assertion,
and the suite adds this independent type-only guard:

```ts
// @ts-expect-error Consumers cannot create a system-owned view.
const systemScope: MlvViewVariantCreateRequest<unknown>['scope'] = 'system';
```

The normal contract passed:

```sh
yarn tsc --noEmit -p libs/core/view-variant/tsconfig.spec.json
```

For the required negative control, the local, unstaged
`MlvViewVariantCreateRequest.scope` was temporarily widened from
`Exclude<MlvViewVariantScope, 'system'>` to `MlvViewVariantScope`. The same
typecheck then failed as intended with:

```text
view-variant-state.spec.ts(94,7): error TS2578: Unused '@ts-expect-error' directive.
```

The exact excluded production type was restored immediately afterward.

`libs/core/view-variant/CLAUDE.md` now documents the seven public contracts,
the helper's deliberately narrow normalizer contract, and the existing focused
verification commands. It explicitly states that no view-variant component or
persistence behavior exists yet.

### Fix Round 1 verification

Passed after restoring the exact production scope exclusion:

```sh
yarn tsc --noEmit -p libs/core/view-variant/tsconfig.spec.json
yarn nx test core-view-variant --skipNxCache
yarn nx typecheck core-view-variant --skipNxCache
yarn nx lint core-view-variant --skipNxCache
yarn nx run docs:check-doc-api
```

The focused suite passed 3/3. The documentation check completed with 0
failures and the repository's pre-existing 240 warnings. Source guards found
all seven documented contracts, the helper section, the independent create
scope assertion, and the restored `Exclude<MlvViewVariantScope, 'system'>`
production type. `git diff --check` passed.
