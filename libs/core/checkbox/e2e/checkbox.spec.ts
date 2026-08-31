// libs/core/checkbox/e2e/checkbox.spec.ts
import {
  defineComponentSpec,
  expect,
  expectInspectorValue,
  test,
} from '@malva-ui/cdk/testing-e2e';
import type { Locator } from '@playwright/test';
import { checkboxManifest } from './checkbox.manifest';

/**
 * Wait until there are at least `min` visible mlv-checkbox items in the scope,
 * then return all of them. Avoids the race where `.all()` runs before Angular
 * has finished hydrating the view inside the lazy-loaded example.
 */
async function waitForCheckboxItems(
  scope: Locator,
  min = 1,
): Promise<Locator[]> {
  await expect(scope.locator('mlv-checkbox').nth(min - 1)).toBeVisible();
  return scope.locator('mlv-checkbox').all();
}

defineComponentSpec(checkboxManifest, () => {
  test.describe('keyboard — WAI-ARIA checkbox', () => {
    test('checkbox is keyboard-focusable and sits in the tab order', async ({
      mlv,
    }) => {
      await mlv.goto(checkboxManifest.route);
      const box = mlv.example(1).locator('mlv-checkbox').first();
      await expect(box).toBeVisible();
      // The single focus target is the visually-hidden native input, not the
      // host. The host must not be tabbable (no tabindex).
      expect(await box.getAttribute('tabindex')).toBeNull();
      const input = box.locator('input.mlv-checkbox__native');
      const tabindex = await input.getAttribute('tabindex');
      expect(tabindex === null || tabindex === '' || tabindex === '0').toBe(
        true,
      );
      await input.focus();
      await expect(input).toBeFocused();
    });

    test('Space toggles the focused checkbox', async ({ mlv }) => {
      await mlv.goto(checkboxManifest.route);
      const box = mlv.example(1).locator('mlv-checkbox').first();
      await expect(box).toBeVisible();
      const input = box.locator('input.mlv-checkbox__native');
      await input.focus();
      // Ensure starting from unchecked state for a deterministic assertion
      await expect(box).not.toHaveClass(/mlv-checkbox--checked/);
      await input.press(' ');
      // Wait for Angular change detection to update the DOM class
      await expect(box).toHaveClass(/mlv-checkbox--checked/);
    });

    test('Enter toggles the focused checkbox', async ({ mlv }) => {
      await mlv.goto(checkboxManifest.route);
      const box = mlv.example(1).locator('mlv-checkbox').first();
      await expect(box).toBeVisible();
      const input = box.locator('input.mlv-checkbox__native');
      // Ensure we start unchecked so the assertion is deterministic
      const isChecked = await box.evaluate((el) =>
        el.classList.contains('mlv-checkbox--checked'),
      );
      if (isChecked) {
        await box.click();
        await expect(box).not.toHaveClass(/mlv-checkbox--checked/);
      }
      await input.focus();
      await input.press('Enter');
      await expect(box).toHaveClass(/mlv-checkbox--checked/);
    });

    test('disabled checkbox renders with disabled class', async ({ mlv }) => {
      await mlv.goto(checkboxManifest.route);
      // Example 2 contains the disabled checkbox — wait for it to appear
      const disabled = mlv
        .example(2)
        .locator('mlv-checkbox.mlv-checkbox--disabled')
        .first();
      await expect(disabled).toBeVisible({ timeout: 10_000 });
      await expect(disabled).toHaveClass(/mlv-checkbox--disabled/);
    });

    test('Tab leaves the group entirely (roving tabindex)', async ({
      mlv,
      page,
    }) => {
      await mlv.goto(checkboxManifest.route);
      // Example 3 has the checkbox-group — wait for it to fully render
      const group = mlv.example(3).locator('mlv-checkbox-group').first();
      await expect(group).toBeVisible({ timeout: 10_000 });
      const items = await waitForCheckboxItems(group, 3);
      await items[0].locator('input.mlv-checkbox__native').focus();
      await page.keyboard.press('Tab');
      // After Tab, focus should have left all group items (and their inputs)
      for (const item of items) {
        const focused = await item.evaluate((el) =>
          el.contains(document.activeElement),
        );
        expect(focused).toBe(false);
      }
    });
  });

  test.describe('innerKeyboard — FocusKeyManager', () => {
    test('ArrowDown moves focus to next item', async ({ mlv, page }) => {
      await mlv.goto(checkboxManifest.route);
      // Example 3 has the checkbox-group
      const group = mlv.example(3).locator('mlv-checkbox-group').first();
      await expect(group).toBeVisible({ timeout: 10_000 });
      const items = await waitForCheckboxItems(group, 3);
      await items[0].locator('input.mlv-checkbox__native').focus();
      await page.keyboard.press('ArrowDown');
      await expect(
        items[1].locator('input.mlv-checkbox__native'),
      ).toBeFocused();
    });

    test('ArrowDown preserves roving tabindex', async ({ mlv, page }) => {
      // tabIndex is now a signal, so MlvCheckboxGroup updates the DOM
      // tabindex attribute as focus moves (see `_syncTabIndices`). The active
      // input becomes tabbable (0); the others leave the tab order (-1).
      await mlv.goto(checkboxManifest.route);
      const group = mlv.example(3).locator('mlv-checkbox-group').first();
      await expect(group).toBeVisible({ timeout: 10_000 });
      const items = await waitForCheckboxItems(group, 3);
      const firstInput = items[0].locator('input.mlv-checkbox__native');
      const secondInput = items[1].locator('input.mlv-checkbox__native');
      await firstInput.focus();
      await page.keyboard.press('ArrowDown');
      await expect(secondInput).toBeFocused();
      await expect(secondInput).toHaveAttribute('tabindex', '0');
      await expect(firstInput).toHaveAttribute('tabindex', '-1');
    });

    test('ArrowUp moves focus to previous item', async ({ mlv, page }) => {
      await mlv.goto(checkboxManifest.route);
      const group = mlv.example(3).locator('mlv-checkbox-group').first();
      await expect(group).toBeVisible({ timeout: 10_000 });
      const items = await waitForCheckboxItems(group, 3);
      await items[1].locator('input.mlv-checkbox__native').focus();
      await page.keyboard.press('ArrowUp');
      await expect(
        items[0].locator('input.mlv-checkbox__native'),
      ).toBeFocused();
    });

    test('ArrowDown wraps from last to first', async ({ mlv, page }) => {
      await mlv.goto(checkboxManifest.route);
      const group = mlv.example(3).locator('mlv-checkbox-group').first();
      await expect(group).toBeVisible({ timeout: 10_000 });
      const items = await waitForCheckboxItems(group, 3);
      await items[items.length - 1]
        .locator('input.mlv-checkbox__native')
        .focus();
      await page.keyboard.press('ArrowDown');
      await expect(
        items[0].locator('input.mlv-checkbox__native'),
      ).toBeFocused();
    });
  });

  test.describe('dataFlow — CVA round-trip', () => {
    test('clicking checkbox updates form.value via inspector', async ({
      mlv,
    }) => {
      await mlv.goto(checkboxManifest.route);
      const scope = mlv.example(1);
      const box = scope.locator('mlv-checkbox').first();
      await expect(box).toBeVisible();
      // Initial value should be false (FormControl starts as false)
      await expectInspectorValue(scope, false);
      // Click to check
      await box.click();
      await expectInspectorValue(scope, true);
      // Click again to uncheck
      await box.click();
      await expectInspectorValue(scope, false);
    });

    test('Space toggles also updates the form value', async ({ mlv }) => {
      await mlv.goto(checkboxManifest.route);
      const scope = mlv.example(1);
      const box = scope.locator('mlv-checkbox').first();
      await expect(box).toBeVisible();
      const input = box.locator('input.mlv-checkbox__native');
      await input.focus();
      await input.press(' ');
      await expectInspectorValue(scope, true);
    });
  });
});
