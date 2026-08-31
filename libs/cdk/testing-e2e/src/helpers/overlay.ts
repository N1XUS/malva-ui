// libs/cdk/testing-e2e/src/helpers/overlay.ts
import { expect, type Locator, type Page } from '@playwright/test';

export async function openOverlay(
  page: Page,
  trigger: Locator,
): Promise<Locator> {
  const ariaControls = await trigger.getAttribute('aria-controls');
  await trigger.click();
  if (ariaControls) {
    const pane = page.locator(`#${ariaControls}`);
    await expect(pane).toBeVisible();
    return pane;
  }
  const panes = page.locator('.cdk-overlay-pane');
  await expect(panes.last()).toBeVisible();
  return panes.last();
}

export async function closeByEscape(page: Page, pane: Locator): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(pane).toBeHidden();
}

export async function closeByBackdrop(
  page: Page,
  pane: Locator,
): Promise<void> {
  await page
    .locator('.cdk-overlay-backdrop')
    .first()
    .click({ position: { x: 1, y: 1 } });
  await expect(pane).toBeHidden();
}
