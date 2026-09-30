import axe from 'axe-core';
import { expect, test, type MlvE2ePage } from '@malva-ui/cdk/testing-e2e';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { editorManifest } from './editor.manifest';

/** `/editor` "Clean mode" example (#516). */
const CLEAN_EXAMPLE = 14;

/** The clean example's parts. */
interface CleanExample {
  readonly scope: Locator;
  readonly editor: Locator;
  readonly content: Locator;
  readonly toc: Locator;
}

/** The dev-mode `ng` global and the editor members these checks read. */
interface NgWindow {
  ng: {
    getComponent(element: Element): {
      value(): string | null;
      zoom: { set(value: number): void };
      editor(): {
        view: { someProp(name: string): unknown };
      } | null;
    };
  };
}

/** Opens `/editor` at `width` × `height` and returns example 14. */
async function openClean(
  mlv: MlvE2ePage,
  width = 1600,
  height = 1000,
): Promise<CleanExample> {
  await mlv.page.setViewportSize({ width, height });
  await mlv.goto(editorManifest.route);
  const scope = mlv.example(CLEAN_EXAMPLE);
  await scope.scrollIntoViewIfNeeded();
  const editor = scope.locator('mlv-editor');
  const content = editor.locator('.ProseMirror');
  await expect(content.locator('h1')).toHaveText('Field guide');
  return { scope, editor, content, toc: scope.locator('nav.mlv-editor-toc') };
}

/** Records a measured fact on the test, and in the log. */
function record(info: TestInfo, type: string, value: unknown): void {
  const description = typeof value === 'string' ? value : JSON.stringify(value);
  info.annotations.push({ type, description });
  console.log(`[${info.project.name}] ${type}: ${description}`);
}

/** The focused element as `tag.class…`, or `role="…"` when it has a role. */
function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element) return 'none';
    const role = element.getAttribute('role');
    const classes = [...element.classList].slice(0, 2).join('.');
    return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}${
      role ? `[role=${role}]` : ''
    }`;
  });
}

/** Whether focus is on the editor content. */
function contentFocused(content: Locator): Promise<boolean> {
  return content.evaluate((element) => element === document.activeElement);
}

/** Text of the block the caret is in. */
function caretBlock(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const node = window.getSelection()?.anchorNode ?? null;
    const element =
      node instanceof Element ? node : (node?.parentElement ?? null);
    const block = element?.closest('.ProseMirror > *');
    return block
      ? `${block.tagName.toLowerCase()}:${block.textContent ?? ''}`
      : null;
  });
}

/** The editor's value, through the dev-mode `ng` global. */
function editorValue(editor: Locator): Promise<string | null> {
  return editor.evaluate((element) =>
    (window as unknown as NgWindow).ng.getComponent(element).value(),
  );
}

/** Where the TOC should land a heading: the scroller's top + both margins. */
async function readingLine(
  editor: Locator,
  heading: Locator,
  frameTop: number,
): Promise<number> {
  return heading.evaluate(
    (element, [host, top]) => {
      const view = (window as unknown as NgWindow).ng
        .getComponent(host as Element)
        .editor()?.view;
      const margin = view?.someProp('scrollMargin') as
        | number
        | { top?: number }
        | undefined;
      const pm = typeof margin === 'number' ? margin : (margin?.top ?? 5);
      return (
        (top as number) +
        pm +
        Number.parseFloat(getComputedStyle(element).scrollMarginBlockStart)
      );
    },
    [await editor.elementHandle(), frameTop] as const,
  );
}

/** Rounded client top of `locator`. */
function topOf(locator: Locator): Promise<number> {
  return locator.evaluate((element) => element.getBoundingClientRect().top);
}

test.describe('Editor clean mode (#516)', () => {
  test('hover and click the "+" inserts a heading below; focus stays in the content', async ({
    mlv,
    page,
  }, info) => {
    const { editor, content, toc } = await openClean(mlv);
    const paragraph = content.locator('p', { hasText: 'Planning note 1:' });
    await paragraph.click();
    await paragraph.hover();

    const add = editor.locator('.mlv-editor__block-add');
    await expect(add).toHaveAttribute('data-visible', 'true');
    const addBox = await add.boundingBox();
    const paragraphBox = await paragraph.boundingBox();
    expect(addBox && paragraphBox).toBeTruthy();
    if (!addBox || !paragraphBox) return;
    // Beside its block, in the inline-start gutter.
    expect(addBox.y).toBeLessThan(paragraphBox.y + paragraphBox.height);
    expect(addBox.y + addBox.height).toBeGreaterThan(paragraphBox.y);
    expect(addBox.x + addBox.width).toBeLessThanOrEqual(paragraphBox.x + 1);

    await add.click();
    await expect(page.getByRole('menu')).toBeVisible();
    record(info, 'focus after a pointer "+"', await focused(page));
    expect(await contentFocused(content)).toBe(true);

    // D-B2 for a non-empty block: the after-block indicator, no document change.
    const indicator = editor.locator('.mlv-editor__drop-indicator');
    await expect(indicator).toHaveAttribute('data-visible', 'true');
    const next = content.locator('p', { hasText: 'Planning note 2:' });
    const [indicatorBox, nextBox] = [
      await indicator.boundingBox(),
      await next.boundingBox(),
    ];
    if (!indicatorBox || !nextBox)
      throw new Error('Expected the indicator and next block.');
    const middle = indicatorBox.y + indicatorBox.height / 2;
    expect(middle).toBeGreaterThanOrEqual(
      paragraphBox.y + paragraphBox.height - 2,
    );
    expect(middle).toBeLessThanOrEqual(nextBox.y + 2);

    await page.getByRole('menuitem', { name: 'Heading level 2' }).click();
    const inserted = paragraph.locator('xpath=following-sibling::*[1]');
    await expect(inserted).toHaveJSProperty('tagName', 'H2');
    await expect(indicator).not.toHaveAttribute('data-visible', 'true');
    expect(await caretBlock(page)).toBe('h2:');
    expect(await contentFocused(content)).toBe(true);

    await page.keyboard.type('Gear');
    await expect(inserted).toHaveText('Gear');
    await expect(toc.getByRole('link', { name: 'Gear' })).toBeVisible();
  });

  test('Escape on the "+" menu leaves the document byte-identical', async ({
    mlv,
    page,
  }) => {
    const { editor, content } = await openClean(mlv);
    const paragraph = content.locator('p', { hasText: 'Trail note 3:' });
    await paragraph.click();
    await paragraph.hover();
    const before = await editorValue(editor);
    const beforeDom = await content.innerHTML();

    await editor.locator('.mlv-editor__block-add').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    expect(await editorValue(editor)).toBe(before);
    expect(await content.innerHTML()).toBe(beforeDom);
    expect(await contentFocused(content)).toBe(true);
  });

  test('keyboard: Alt+F10 → Insert block → first item focused → Bullet list', async ({
    mlv,
    page,
  }, info) => {
    const { content } = await openClean(mlv);
    const paragraph = content.locator('p', { hasText: 'Trail note 2:' });
    await paragraph.click();

    await page.keyboard.press('Alt+F10');
    const insert = page
      .locator('.mlv-editor-bubble')
      .getByRole('button', { name: 'Insert block' });
    await expect(insert).toBeFocused();

    await page.keyboard.press('Enter');
    const items = page.getByRole('menuitem');
    await expect(items.first()).toBeFocused();
    record(info, 'first menu item', await items.first().innerText());

    const bullet = page.getByRole('menuitem', { name: 'Bullet list' });
    for (let step = 0; step < 16; step += 1) {
      if (
        await bullet.evaluate((element) => element === document.activeElement)
      )
        break;
      await page.keyboard.press('ArrowDown');
    }
    await expect(bullet).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(
      paragraph.locator('xpath=following-sibling::*[1]'),
    ).toHaveJSProperty('tagName', 'UL');
    expect(await contentFocused(content)).toBe(true);
  });

  test('D-B2: an empty paragraph is outlined while the menu is open, then converted in place', async ({
    mlv,
    page,
  }) => {
    const { editor, content } = await openClean(mlv);
    const last = content.locator('p', { hasText: 'Write the trip up' });
    await last.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    const empty = last.locator('xpath=following-sibling::*[1]');
    await expect(empty).toHaveJSProperty('tagName', 'P');
    await expect(empty).toHaveText('');

    const openMenu = async () => {
      await page.keyboard.press('Alt+F10');
      await expect(
        page
          .locator('.mlv-editor-bubble')
          .getByRole('button', { name: 'Insert block' }),
      ).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitem').first()).toBeFocused();
    };

    await openMenu();
    const target = editor.locator('.mlv-editor__block-target');
    await expect(target).toBeVisible();
    const [targetBox, emptyBox] = [
      await target.boundingBox(),
      await empty.boundingBox(),
    ];
    if (!targetBox || !emptyBox)
      throw new Error('Expected the target and the block.');
    expect(Math.abs(targetBox.y - emptyBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(targetBox.height - emptyBox.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(targetBox.x - emptyBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(targetBox.width - emptyBox.width)).toBeLessThanOrEqual(1);
    expect(
      await target.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      ),
    ).toBe('dashed');
    await expect(
      editor.locator('.mlv-editor__drop-indicator'),
    ).not.toHaveAttribute('data-visible', 'true');

    await page.keyboard.press('Escape');
    await expect(target).toHaveCount(0);
    await expect(empty).toHaveJSProperty('tagName', 'P');

    await openMenu();
    await page.getByRole('menuitem', { name: 'Heading level 3' }).click();
    // Converted in place, not inserted below. The empty paragraph after it is
    // Tiptap's `trailingNode`, which keeps a paragraph after a final heading.
    await expect(empty).toHaveJSProperty('tagName', 'H3');
    await expect(empty).toHaveText('');
    const trailing = last.locator('xpath=following-sibling::*[2]');
    await expect(trailing).toHaveJSProperty('tagName', 'P');
    await expect(trailing).toHaveText('');
    await expect(last.locator('xpath=following-sibling::*[3]')).toHaveCount(0);
    expect(await caretBlock(page)).toBe('h3:');
  });

  test('the "+" sits on the inline-start side, mirrored in a scoped RTL subtree', async ({
    mlv,
  }) => {
    const { scope, editor, content } = await openClean(mlv);
    const add = editor.locator('.mlv-editor__block-add');
    const paragraph = content.locator('p', { hasText: 'Planning note 3:' });

    await paragraph.hover();
    await expect(add).toHaveAttribute('data-visible', 'true');
    let [addBox, paragraphBox] = [
      await add.boundingBox(),
      await paragraph.boundingBox(),
    ];
    if (!addBox || !paragraphBox) throw new Error('Expected both boxes.');
    expect(addBox.x + addBox.width).toBeLessThanOrEqual(paragraphBox.x + 1);

    await scope
      .locator('.docs-clean')
      .evaluate((element) => element.setAttribute('dir', 'rtl'));
    await content.locator('p', { hasText: 'Planning note 4:' }).hover();
    await paragraph.hover();
    await expect(add).toHaveAttribute('data-visible', 'true');
    [addBox, paragraphBox] = [
      await add.boundingBox(),
      await paragraph.boundingBox(),
    ];
    if (!addBox || !paragraphBox) throw new Error('Expected both boxes.');
    expect(addBox.x).toBeGreaterThanOrEqual(
      paragraphBox.x + paragraphBox.width - 1,
    );
  });

  test('SC 2.5.8: the "+" keeps a 24px target at a narrow width', async ({
    mlv,
  }, info) => {
    const { editor, content } = await openClean(mlv, 600, 900);
    await content.locator('p', { hasText: 'Planning note 1:' }).hover();
    const add = editor.locator('.mlv-editor__block-add');
    await expect(add).toHaveAttribute('data-visible', 'true');
    const box = await add.boundingBox();
    const handle = await editor
      .locator('.mlv-editor__block-handle')
      .boundingBox();
    record(info, 'narrow "+" / handle boxes', { add: box, handle });
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  });

  test('Mod+Alt+Enter: the chord and AltGraph, per engine', async ({
    mlv,
    page,
  }, info) => {
    const { content } = await openClean(mlv);
    await page.evaluate(() => {
      const seen: unknown[] = [];
      (window as unknown as { zzChord: unknown[] }).zzChord = seen;
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'Enter') return;
          seen.push({
            alt: event.altKey,
            meta: event.metaKey,
            ctrl: event.ctrlKey,
            altGraph: event.getModifierState('AltGraph'),
          });
        },
        { capture: true },
      );
    });
    await content.locator('p', { hasText: 'Trail note 1:' }).click();
    await page.keyboard.press('ControlOrMeta+Alt+Enter');
    const menu = page.getByRole('menu');
    const opened = await menu
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch(() => false);
    const events = (await page.evaluate(
      () => (window as unknown as { zzChord: unknown[] }).zzChord,
    )) as Array<{ altGraph: boolean }>;
    record(info, 'chord keydown', {
      platform: process.platform,
      events,
      opened,
    });
    expect(events).toHaveLength(1);
    // D-B6: an AltGraph keydown never triggers the chord.
    expect(opened).toBe(!events[0].altGraph);
  });

  test('docs example passes axe in a real browser, color-contrast included', async ({
    mlv,
    page,
  }, info) => {
    const { content } = await openClean(mlv);
    await page.addScriptTag({ content: axe.source });
    const sweep = (selector: string, index: number) =>
      page.evaluate(
        async ([query, at]) => {
          const root = document.querySelectorAll(query as string)[at as number];
          const browserAxe = (
            window as unknown as {
              axe: {
                run(context: Element): Promise<{
                  violations: Array<{
                    id: string;
                    nodes: Array<{ target: unknown[] }>;
                  }>;
                  passes: Array<{ id: string }>;
                  incomplete: Array<{ id: string }>;
                }>;
              };
            }
          ).axe;
          const results = await browserAxe.run(root);
          return {
            violations: results.violations.map(
              ({ id, nodes }) =>
                `${id}: ${nodes.map((node) => node.target.join(' ')).join(', ')}`,
            ),
            contrast: results.passes.some(({ id }) => id === 'color-contrast')
              ? 'pass'
              : results.incomplete.some(({ id }) => id === 'color-contrast')
                ? 'incomplete'
                : 'not run',
          };
        },
        [selector, index] as const,
      );

    const idle = await sweep('docs-example-container', CLEAN_EXAMPLE - 1);
    record(info, 'axe idle', idle);

    await content.locator('p', { hasText: 'Planning note 2:' }).click();
    await page.keyboard.press('Alt+F10');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem').first()).toBeFocused();
    const open = await sweep('.cdk-overlay-container', 0);
    record(info, 'axe open menu', open);

    expect(idle.contrast).not.toBe('not run');
    expect(idle.violations).toEqual([]);
    expect(open.violations).toEqual([]);
  });
});

test.describe('Editor clean mode on touch (#516, § 17 item 8)', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('the "+" follows the caret; a tap opens the menu with focus kept', async ({
    mlv,
    page,
  }, info) => {
    const { editor, content } = await openClean(mlv, 900, 1000);
    const hoverNone = await page.evaluate(
      () => matchMedia('(hover: none)').matches,
    );
    record(info, '(hover: none)', hoverNone);

    const paragraph = content.locator('p', { hasText: 'Trail note 4:' });
    await paragraph.tap();
    const add = editor.locator('.mlv-editor__block-add');
    await expect(add).toHaveAttribute('data-visible', 'true');
    const [addBox, paragraphBox] = [
      await add.boundingBox(),
      await paragraph.boundingBox(),
    ];
    if (!addBox || !paragraphBox) throw new Error('Expected both boxes.');
    record(info, 'touch "+" / block', { add: addBox, block: paragraphBox });
    expect(addBox.y).toBeLessThan(paragraphBox.y + paragraphBox.height);
    expect(addBox.y + addBox.height).toBeGreaterThan(paragraphBox.y);
    expect(addBox.width).toBeGreaterThanOrEqual(24);
    expect(addBox.height).toBeGreaterThanOrEqual(24);

    const caretBefore = await caretBlock(page);
    await add.tap();
    await expect(page.getByRole('menu')).toBeVisible();
    const afterTap = {
      focus: await focused(page),
      contentFocused: await contentFocused(content),
      caret: await caretBlock(page),
      caretBefore,
    };
    record(info, 'after a tap on "+"', afterTap);
    // Opened on release; no compatibility click follows to dismiss it.
    await page.waitForTimeout(400);
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('ArrowDown');
    record(info, 'ArrowDown after the tap', await focused(page));
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    record(info, 'Escape after the tap', {
      focus: await focused(page),
      caret: await caretBlock(page),
    });

    expect(afterTap.contentFocused).toBe(true);
  });
});

test.describe('Editor table of contents (#516, U9)', () => {
  test('a click scrolls the heading to the reading line, moves the caret and marks it current', async ({
    mlv,
    page,
  }, info) => {
    const { editor, content, toc } = await openClean(mlv);
    await expect(toc).toHaveAttribute('aria-label', 'Table of contents');
    await expect(toc.getByRole('link')).toHaveText([
      'Field guide',
      'Planning',
      'Checklist',
      'On the trail',
      'Weather',
      'Coming home',
    ]);
    const link = toc.getByRole('link', { name: 'On the trail' });
    expect(await link.getAttribute('href')).toMatch(/#guide-on-the-trail$/);

    await link.click();
    const heading = content.locator('#guide-on-the-trail');
    const line = await readingLine(editor, heading, 0);
    await expect
      .poll(async () => Math.abs((await topOf(heading)) - line))
      .toBeLessThanOrEqual(1);
    record(info, 'uncapped line / top', { line, top: await topOf(heading) });
    await expect(link).toHaveAttribute('aria-current', 'location');
    expect(await caretBlock(page)).toBe('h2:On the trail');
    expect(await contentFocused(content)).toBe(true);
    // Clear of the docs app bar: the heading itself is hit at its top.
    expect(
      await heading.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(rect.left + 4, rect.top + 4),
        );
      }),
    ).toBe(true);

    // The active item follows the scroll.
    const planning = content.locator('#guide-planning');
    const scrollTo = (offset: number) =>
      planning.evaluate((element, value) => {
        window.scrollBy({
          top: element.getBoundingClientRect().top - value,
          behavior: 'instant',
        });
      }, offset);
    await scrollTo(line - 2);
    await expect(toc.getByRole('link', { name: 'Planning' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    await scrollTo(line + 60);
    await expect(
      toc.getByRole('link', { name: 'Field guide' }),
    ).toHaveAttribute('aria-current', 'location');
    await expect(toc.locator('[aria-current]')).toHaveCount(1);
  });

  test('a capped editor at 125 % zoom: scroll, active item and the bottom rule', async ({
    mlv,
  }, info) => {
    const { editor, content, toc } = await openClean(mlv);
    // Cap and zoom the example's editor in place: `height` is an input the
    // example does not bind, so the host gets what the binding would write.
    await editor.evaluate((element) => {
      element.classList.add('mlv-editor--capped');
      (element as HTMLElement).style.setProperty(
        '--mlv-editor-height',
        '22rem',
      );
      (window as unknown as NgWindow).ng.getComponent(element).zoom.set(125);
    });
    const viewport = editor.locator('.mlv-editor__viewport');
    await expect
      .poll(() =>
        editor.evaluate((element) =>
          getComputedStyle(element)
            .getPropertyValue('--mlv-editor-zoom')
            .trim(),
        ),
      )
      .toBe('1.25');
    await expect(editor).toHaveClass(/mlv-editor--capped/);
    expect(
      await viewport.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);

    const link = toc.getByRole('link', { name: 'On the trail' });
    await link.click();
    const heading = content.locator('#guide-on-the-trail');
    const frameTop = () =>
      viewport.evaluate(
        (element) => element.getBoundingClientRect().top + element.clientTop,
      );
    await expect
      .poll(async () =>
        Math.abs(
          (await topOf(heading)) -
            (await readingLine(editor, heading, await frameTop())),
        ),
      )
      .toBeLessThanOrEqual(1);
    const measured = {
      frameTop: await frameTop(),
      line: await readingLine(editor, heading, await frameTop()),
      top: await topOf(heading),
      pageScroll: await viewport.evaluate(() => window.scrollY),
    };
    record(info, 'capped 125% line / top', measured);
    await expect(link).toHaveAttribute('aria-current', 'location');

    // Bottom rule: at the end, the last heading activates below the line.
    await viewport.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const last = toc.getByRole('link', { name: 'Coming home' });
    await expect(last).toHaveAttribute('aria-current', 'location');
    const lastHeading = content.locator('#guide-coming-home');
    const bottom = {
      top: await topOf(lastHeading),
      line: await readingLine(editor, lastHeading, await frameTop()),
    };
    record(info, 'capped bottom rule', bottom);
    expect(bottom.top).toBeGreaterThan(bottom.line + 1);
  });

  test('scoped RTL: the active link is marked on its inline-start edge', async ({
    mlv,
  }) => {
    const { scope, toc } = await openClean(mlv);
    await scope
      .locator('.docs-clean')
      .evaluate((element) => element.setAttribute('dir', 'rtl'));
    const link = toc.getByRole('link', { name: 'Checklist' });
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'location');
    const borders = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        right: style.borderRightWidth,
        left: style.borderLeftWidth,
        align: style.textAlign,
      };
    });
    expect(borders.right).not.toBe('0px');
    expect(borders.left).toBe('0px');
  });
});
