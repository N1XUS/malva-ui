// libs/cdk/testing-e2e/src/fixtures/mlv-page.ts
import type { Page, Locator } from '@playwright/test';

/**
 * Thin page-object wrapper that encapsulates navigation to docs routes and
 * scoping helpers used by every spec.
 */
export class MlvE2ePage {
  constructor(readonly page: Page) {}

  /** Navigate to `/<component>` and wait for the first example container. */
  async goto(route: string): Promise<void> {
    await this.page.goto(route);
    await this.page
      .locator('docs-example-container')
      .first()
      .waitFor({ state: 'visible' });
  }

  /** Return the Nth `<docs-example-container>` (1-indexed to match docs numbering). */
  example(n: number): Locator {
    return this.page.locator('docs-example-container').nth(n - 1);
  }

  /** The CDK overlay root — where portaled dropdowns / dialogs / tooltips render. */
  overlayRoot(): Locator {
    return this.page.locator('.cdk-overlay-container');
  }
}
