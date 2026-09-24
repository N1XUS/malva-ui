// libs/cdk/testing-e2e/src/playwright/base-config.ts
//
// Type-only on purpose. A Playwright config imports `createE2eConfig` from
// `@malva-ui/cdk/testing-e2e/playwright-config.mts` as ESM; a value re-export
// here made every spec that imports this barrel `require()` that same `.mts`
// a second time, through Playwright's CommonJS transform. From Playwright 1.63
// on a Node with `module.registerHooks` (22.15+, and the `.nvmrc` line), the
// second load of a module the config already loaded as ESM fails — "Cannot use
// import statement outside a module" — and the run reports "No tests found".
// An erased type export never loads the file.
export type { MlvE2eConfigOptions } from '../../playwright-config.mjs';
