import { expect, test, type MlvE2ePage } from '@malva-ui/cdk/testing-e2e';
import type { Locator, Page } from '@playwright/test';
import { editorManifest } from './editor.manifest';

/** `/editor` "Text styles and heading links" example. */
const TEXT_STYLES_EXAMPLE = 13;

/** Opens example 13 and returns the editor labelled `label` inside it. */
async function editorIn(mlv: MlvE2ePage, label: string): Promise<Locator> {
  await mlv.page.setViewportSize({ width: 1600, height: 1000 });
  await mlv.goto(editorManifest.route);
  const scope = mlv.example(TEXT_STYLES_EXAMPLE);
  await scope.scrollIntoViewIfNeeded();
  // The label also holds the hint trigger, so match its text, not exactly.
  const editor = scope.locator('mlv-editor', {
    has: mlv.page.locator('mlv-label', { hasText: label }),
  });
  await expect(
    editor.locator('.ProseMirror h2, .ProseMirror h3').first(),
  ).toBeVisible();
  return editor;
}

/** Headings in Chromium's own accessibility tree (CDP), as `role "name"`. */
async function nativeHeadingNames(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
    nodes: Array<{
      ignored?: boolean;
      role?: { value?: string };
      name?: { value?: string };
    }>;
  };
  await cdp.detach();
  return nodes
    .filter((node) => !node.ignored && node.role?.value === 'heading')
    .map((node) => (node.name?.value ?? '').trim());
}

test.describe('Editor heading links (#514)', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('copies a readonly heading link that navigates to the heading', async ({
    mlv,
    page,
  }) => {
    const preview = await editorIn(mlv, 'Readonly preview');
    const heading = preview.locator('h3#getting-started-1');
    await expect(heading).toHaveText('Getting started');

    await heading.getByRole('button', { name: 'Copy link to heading' }).click();

    const href = new URL('/editor#getting-started-1', page.url()).href;
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(href);
    await expect(page.locator('.cdk-live-announcer-element')).toHaveText(
      'Link copied',
    );

    // Hash navigation to the copied fragment scrolls the heading into view.
    await page.evaluate(() => window.scrollTo(0, 0));
    const viewport = page.viewportSize()?.height ?? 1000;
    const top = (): Promise<number> =>
      heading.evaluate((element) => element.getBoundingClientRect().top);
    expect(await top()).toBeGreaterThan(viewport);
    await page.evaluate((fragment) => {
      window.location.hash = fragment;
    }, new URL(href).hash);
    await expect.poll(top).toBeLessThan(viewport);
    expect(await top()).toBeGreaterThanOrEqual(-1);
  });

  test('names an editable heading by its text, a readonly one with its button', async ({
    mlv,
    page,
  }) => {
    const styles = await editorIn(mlv, 'Text styles');
    await expect(
      styles.locator('h2#typography-sample .mlv-editor__heading-link'),
    ).toHaveAttribute('aria-hidden', 'true');

    const names = await nativeHeadingNames(page);
    expect(names).toContain('Typography sample');
    expect(names).toContain('Getting started Copy link to heading');
  });
});
