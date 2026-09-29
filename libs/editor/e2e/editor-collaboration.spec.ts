import { expect, MlvE2ePage, test } from '@malva-ui/cdk/testing-e2e';
import type { Locator } from '@playwright/test';

/** `/editor-collaboration`, example 2: one document over a BroadcastChannel. */
const ROUTE = '/editor-collaboration';
const CROSS_TAB_EXAMPLE = 2;

/** The cross-tab example's parts in one page. */
function parts(mlv: MlvE2ePage) {
  const scope = mlv.example(CROSS_TAB_EXAMPLE);
  return {
    scope,
    content: scope.locator('mlv-editor .ProseMirror'),
    status: scope.locator('.mlv-editor-presence__status-text'),
    avatars: scope.locator('mlv-editor-presence mlv-avatar[role="img"]'),
    carets: scope.locator('.mlv-editor__caret'),
  };
}

/** The name this tab picked, read from the example's "You are … in this tab." line. */
async function nameOf(scope: Locator): Promise<string> {
  const line = await scope.locator('p', { hasText: 'You are' }).textContent();
  const match = /You are (.+) in this tab\./.exec(line ?? '');
  if (!match) throw new Error(`no name in "${line}"`);
  return match[1];
}

test.describe('Editor collaboration across tabs (#515)', () => {
  test('two tabs converge on one document, list each other and show a named caret', async ({
    mlv,
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await mlv.goto(ROUTE);
    const first = parts(mlv);
    await first.scope.scrollIntoViewIfNeeded();

    const other = new MlvE2ePage(await page.context().newPage());
    await other.page.setViewportSize({ width: 1400, height: 1000 });
    await other.goto(ROUTE);
    const second = parts(other);
    await second.scope.scrollIntoViewIfNeeded();

    // Both sync, and the seed both tabs passed lands once, not twice.
    await expect(first.status).toHaveText('All changes synced', {
      timeout: 10_000,
    });
    await expect(second.status).toHaveText('All changes synced');
    for (const side of [first, second]) {
      await expect(side.content.locator('p')).toHaveCount(1);
      await expect(side.content).toContainText('Open this page');
      await expect(side.avatars).toHaveCount(1);
    }

    // An edit in one tab reaches the other.
    await second.content.click();
    await other.page.keyboard.press('End');
    await other.page.keyboard.type(' Hello from the second tab.');
    await expect(first.content).toContainText('Hello from the second tab.');

    // The second tab's caret, named, is drawn in the first — and only there.
    const secondName = await nameOf(second.scope);
    await expect(first.carets).toHaveCount(1);
    await expect(first.carets.locator('.mlv-editor__caret-label')).toHaveText(
      secondName,
    );
    await expect(first.carets).toHaveAttribute('aria-hidden', 'true');
    await expect(second.carets).toHaveCount(0);
    await expect(first.avatars).toHaveAttribute('aria-label', secondName);

    await other.page.close();
  });
});
