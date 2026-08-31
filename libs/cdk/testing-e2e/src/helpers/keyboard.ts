// libs/cdk/testing-e2e/src/helpers/keyboard.ts
import { expect, type Locator, type Page } from '@playwright/test';

export async function expectFocused(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
}

export async function pressSequence(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

/**
 * Roving tabindex assertion: exactly one item has tabindex=0, the rest -1.
 * Optionally enforces a specific active index.
 */
export async function assertRovingTabindex(
  items: Locator[],
  activeIndex?: number,
): Promise<void> {
  const tabIndices = await Promise.all(
    items.map((it) => it.getAttribute('tabindex')),
  );
  const zeros = tabIndices
    .map((ti, i) => (ti === '0' ? i : -1))
    .filter((i) => i !== -1);
  expect(zeros.length).toBe(1);
  if (activeIndex !== undefined) {
    expect(zeros[0]).toBe(activeIndex);
  }
}

export async function assertReturnsFocusTo(
  trigger: Locator,
  close: () => Promise<void>,
): Promise<void> {
  await close();
  await expect(trigger).toBeFocused();
}

/**
 * Focus trap assertion: Tab from the last wraps to the first, Shift+Tab from
 * the first wraps to the last.
 */
export async function assertFocusTrapped(
  page: Page,
  firstFocusable: Locator,
  lastFocusable: Locator,
): Promise<void> {
  await lastFocusable.focus();
  await page.keyboard.press('Tab');
  await expect(firstFocusable).toBeFocused();
  await firstFocusable.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(lastFocusable).toBeFocused();
}

export async function assertTypeAhead(
  page: Page,
  char: string,
  expected: Locator,
): Promise<void> {
  await page.keyboard.type(char);
  await expect(expected).toBeFocused();
}
