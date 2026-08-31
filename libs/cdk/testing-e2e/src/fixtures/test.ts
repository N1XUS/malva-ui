// libs/cdk/testing-e2e/src/fixtures/test.ts
import { test as base, expect } from '@playwright/test';
import { MlvE2ePage } from './mlv-page';

export interface MlvFixtures {
  mlv: MlvE2ePage;
}

/**
 * Extended Playwright `test` that injects `window.__MLV_E2E__ = true` before
 * Angular bootstraps, making the `<docs-inspector>` panel visible for the run.
 */
export const test = base.extend<MlvFixtures>({
  mlv: async ({ page }, use) => {
    await page.addInitScript(() => {
      (window as unknown as { __MLV_E2E__: boolean }).__MLV_E2E__ = true;
    });
    await use(new MlvE2ePage(page));
  },
});

export { expect };
