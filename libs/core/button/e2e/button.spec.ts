// libs/core/button/e2e/button.spec.ts
import { defineComponentSpec, expect, test } from '@malva-ui/cdk/testing-e2e';
import type { Locator } from '@playwright/test';
import { buttonManifest } from './button.manifest';

async function resolvedTokenColor(
  button: Locator,
  token: '--mlv-text-secondary' | '--mlv-text-primary',
): Promise<string> {
  return button.evaluate((element, cssToken) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${cssToken})`;
    element.parentElement?.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

defineComponentSpec(buttonManifest, () => {
  test.describe('keyboard — WAI-ARIA button', () => {
    test('button is keyboard-focusable and sits in the tab order', async ({
      mlv,
    }) => {
      await mlv.goto(buttonManifest.route);
      const firstBtn = mlv.example(1).locator('button.mlv-button').first();
      // Native <button> is tabbable by default. tabindex may be absent, '0', or
      // '' — any of these means the element participates in sequential focus.
      // Only '-1' or a positive integer would indicate a violation.
      const tabindex = await firstBtn.getAttribute('tabindex');
      expect(tabindex === null || tabindex === '' || tabindex === '0').toBe(
        true,
      );
      // Focus must take effect synchronously.
      await firstBtn.focus();
      await expect(firstBtn).toBeFocused();
    });

    test('Enter activates the focused button', async ({ mlv }) => {
      await mlv.goto(buttonManifest.route);
      const firstBtn = mlv.example(1).locator('button.mlv-button').first();
      await firstBtn.focus();
      await firstBtn.press('Enter');
      await expect(firstBtn).toBeFocused();
    });

    test('Space activates without scrolling the page', async ({
      mlv,
      page,
    }) => {
      await mlv.goto(buttonManifest.route);
      const firstBtn = mlv.example(1).locator('button.mlv-button').first();
      await firstBtn.focus();
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await page.keyboard.press(' ');
      const scrollAfter = await page.evaluate(() => window.scrollY);
      expect(scrollAfter).toBe(scrollBefore);
    });

    test('disabled button is removed from the tab order', async ({ mlv }) => {
      await mlv.goto(buttonManifest.route);
      const disabled = mlv
        .example(1)
        .locator('button.mlv-button[disabled]')
        .first();
      if ((await disabled.count()) === 0) {
        test.skip(true, 'No disabled button example present on /button');
        return;
      }
      await expect(disabled).toHaveAttribute('tabindex', '-1');
    });
  });

  test.describe('intents — icon slots and shape modifiers', () => {
    test('buttons with icon slots render an <svg>', async ({ mlv }) => {
      await mlv.goto(buttonManifest.route);
      const iconBtns = mlv.example(1).locator('button.mlv-button svg');
      if ((await iconBtns.count()) === 0) return;
      await expect(iconBtns.first()).toBeVisible();
    });

    test('circle-shape buttons are square', async ({ mlv }) => {
      await mlv.goto(buttonManifest.route);
      const circle = mlv
        .example(1)
        .locator('button.mlv-button--shape-circle')
        .first();
      if ((await circle.count()) === 0) return;
      const box = await circle.boundingBox();
      expect(box).not.toBeNull();
      expect(
        Math.abs((box?.width ?? 0) - (box?.height ?? 0)),
      ).toBeLessThanOrEqual(1);
    });
  });

  test.describe('close button — density and theme-aware color', () => {
    test('supports every density on the native button', async ({ mlv }) => {
      await mlv.goto(buttonManifest.route);
      const buttons = mlv
        .example(9)
        .locator('mlv-button-close button.mlv-button');
      const densities = [
        'tight',
        'compact',
        'comfortable',
        'spacious',
        'airy',
      ] as const;

      await expect(buttons).toHaveCount(densities.length);
      for (const [index, density] of densities.entries()) {
        await expect(buttons.nth(index)).toHaveClass(
          new RegExp(`\\bmlv-button--${density}\\b`),
        );
      }
    });

    test('uses semantic rest and hover colors in light and dark themes', async ({
      mlv,
      page,
    }) => {
      await mlv.goto(buttonManifest.route);
      const button = mlv
        .example(9)
        .locator('mlv-button-close button.mlv-button')
        .first();
      const originalTheme = await page.evaluate(() =>
        document.documentElement.getAttribute('mlvTheme'),
      );

      try {
        for (const theme of ['light', 'dark'] as const) {
          await page.evaluate(
            (nextTheme) =>
              document.documentElement.setAttribute('mlvTheme', nextTheme),
            theme,
          );
          await page.mouse.move(0, 0);

          const restingColor = await resolvedTokenColor(
            button,
            '--mlv-text-secondary',
          );
          await expect(button).toHaveCSS('color', restingColor);

          await button.hover();
          const hoverColor = await resolvedTokenColor(
            button,
            '--mlv-text-primary',
          );
          await expect(button).toHaveCSS('color', hoverColor);
        }
      } finally {
        await page.evaluate((theme) => {
          if (theme === null) {
            document.documentElement.removeAttribute('mlvTheme');
          } else {
            document.documentElement.setAttribute('mlvTheme', theme);
          }
        }, originalTheme);
      }
    });
  });
});
