import { expect, test, type MlvE2ePage } from '@malva-ui/cdk/testing-e2e';
import type { Locator } from '@playwright/test';
import { editorManifest } from './editor.manifest';

/** `/editor` "Layout" example (position, appearance, max height, sticky). */
const LAYOUT_EXAMPLE = 12;
/** `/editor` "Tables and independent view zoom" example (80 / 100 / 125 %). */
const TABLE_ZOOM_EXAMPLE = 8;

async function gotoExample(
  mlv: MlvE2ePage,
  example: number,
  width = 1600,
): Promise<Locator> {
  await mlv.page.setViewportSize({ width, height: 1000 });
  await mlv.goto(editorManifest.route);
  const scope = mlv.example(example);
  // The per-example switchers are `@defer (on viewport)`.
  await scope.scrollIntoViewIfNeeded();
  return scope;
}

/** Picks one option of a named `mlv-segmented` radiogroup inside `scope`. */
async function pick(scope: Locator, group: string, option: string) {
  await scope
    .getByRole('radiogroup', { name: group })
    .getByRole('radio', { name: option })
    .click();
}

/** Scroll offset of the document scroller (`docs-shell` is `sizing="content"`). */
async function pageScrollTop(mlv: MlvE2ePage): Promise<number> {
  return mlv.page.evaluate(
    () => (document.scrollingElement ?? document.documentElement).scrollTop,
  );
}

/**
 * Every element from the viewport up to the first ancestor matching `stop`
 * (inclusive) that is a scroll container or stops scroll chaining. Empty
 * means nothing between the content and `stop` can capture a scroll.
 */
async function scrollBarriers(editor: Locator, stop: string) {
  return editor.evaluate((host, stopSelector) => {
    const barriers: string[] = [];
    const boundary = host.closest(stopSelector);
    let element: Element | null = host.querySelector('.mlv-editor__viewport');
    while (element) {
      const style = getComputedStyle(element);
      const scrolls = [style.overflowX, style.overflowY].some(
        (value) => value === 'auto' || value === 'scroll' || value === 'hidden',
      );
      const contains =
        style.overscrollBehaviorX !== 'auto' ||
        style.overscrollBehaviorY !== 'auto';
      if (scrolls || contains) {
        barriers.push(
          `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`,
        );
      }
      if (element === boundary) break;
      element = element.parentElement;
    }
    return barriers;
  }, stop);
}

/** Moves the pointer inside the visible part of `target` and wheels by `deltaY`. */
async function wheelOver(mlv: MlvE2ePage, target: Locator, deltaY: number) {
  const box = await target.boundingBox();
  if (!box) throw new Error('Expected a rendered wheel target.');
  const viewportHeight = mlv.page.viewportSize()?.height ?? 1000;
  const y = Math.min(box.y + Math.min(box.height / 2, 40), viewportHeight - 20);
  await mlv.page.mouse.move(box.x + box.width / 2, Math.max(y, 20));
  await mlv.page.mouse.wheel(0, deltaY);
}

/** Pill, band and first/last block geometry, plus the resolved overlap token. */
async function pillGeometry(editor: Locator) {
  return editor.evaluate((host) => {
    const pill = host.querySelector('.mlv-editor__toolbar') as HTMLElement;
    const band = host.querySelector('.mlv-editor__toolbar-band') as HTMLElement;
    const blocks = host.querySelectorAll('.ProseMirror > *');
    const probe = document.createElement('div');
    probe.style.blockSize = 'var(--mlv-editor-toolbar-block-size)';
    host.append(probe);
    const token = probe.getBoundingClientRect().height;
    probe.remove();
    const pillRect = pill.getBoundingClientRect();
    const bandRect = band.getBoundingClientRect();
    return {
      token,
      pillHeight: pillRect.height,
      pillTop: pillRect.top,
      pillBottom: pillRect.bottom,
      pillCenter: pillRect.left + pillRect.width / 2,
      bandCenter: bandRect.left + bandRect.width / 2,
      firstBlockTop: blocks[0]?.getBoundingClientRect().top ?? Number.NaN,
      lastBlockBottom:
        blocks[blocks.length - 1]?.getBoundingClientRect().bottom ?? Number.NaN,
    };
  });
}

/** Resolves a length custom property on `host` to px through a probe box. */
async function resolvedLength(editor: Locator, expression: string) {
  return editor.evaluate((host, value) => {
    const probe = document.createElement('div');
    probe.style.blockSize = value;
    host.append(probe);
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px;
  }, expression);
}

async function setSticky(scope: Locator, on: boolean) {
  const toggle = scope.getByRole('switch', { name: 'Sticky toolbar' });
  if ((await toggle.isChecked()) !== on) {
    await scope.locator('mlv-switch', { hasText: 'Sticky toolbar' }).click();
  }
  await expect(toggle).toBeChecked({ checked: on });
}

/**
 * Scrolls `scroller` so a middle one-line paragraph sits just inside the band
 * on the toolbar's side, puts the caret at its end, presses Enter
 * (`splitBlock` dispatches `scrollIntoView()`), and returns the new block's
 * rect next to the pill's.
 */
async function enterUnderToolbar(
  mlv: MlvE2ePage,
  editor: Locator,
  side: 'top' | 'bottom',
  scroller: 'viewport' | 'page',
) {
  await editor.evaluate(
    (host, { side, scroller }) => {
      const content = host.querySelector('.ProseMirror') as HTMLElement;
      content.focus({ preventScroll: true });
      const bandElement = host.querySelector(
        '.mlv-editor__toolbar-band',
      ) as HTMLElement;
      const blocks = [...content.querySelectorAll<HTMLElement>(':scope > p')];
      const target = blocks[Math.floor(blocks.length / 2)];
      if (scroller === 'page') {
        // The Layout example is the last on the page, so the page bottom would
        // clamp the scroll short of the band. Give the page room below it.
        const spacer = document.createElement('div');
        spacer.style.blockSize = '100vh';
        host.closest('docs-example-container')?.after(spacer);
      }
      // Until it settles: a page-sticky band scrolls with the page until the
      // surface passes the offset and only then pins, so one pass measures
      // the band where it was, not where it sticks.
      for (let pass = 0; pass < 5; pass++) {
        const band = bandElement.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        const delta =
          side === 'top'
            ? rect.top - (band.top + 1)
            : rect.bottom - (band.bottom - 1);
        if (Math.abs(delta) < 0.5) break;
        if (scroller === 'viewport') {
          (
            host.querySelector('.mlv-editor__viewport') as HTMLElement
          ).scrollTop += delta;
        } else {
          (document.scrollingElement ?? document.documentElement).scrollBy({
            top: delta,
            behavior: 'instant',
          });
        }
      }
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    { side, scroller },
  );
  await mlv.page.keyboard.press('Enter');
  return editor.evaluate((host) => {
    const anchor = getSelection()?.anchorNode ?? null;
    const element =
      anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
    const block = element?.closest('.ProseMirror > *')?.getBoundingClientRect();
    const pill = (
      host.querySelector('.mlv-editor__toolbar') as HTMLElement
    ).getBoundingClientRect();
    const band = (
      host.querySelector('.mlv-editor__toolbar-band') as HTMLElement
    ).getBoundingClientRect();
    return {
      blockTop: block?.top ?? Number.NaN,
      blockBottom: block?.bottom ?? Number.NaN,
      pillTop: pill.top,
      pillBottom: pill.bottom,
      bandTop: band.top,
      bandBottom: band.bottom,
    };
  });
}

test.describe('Editor layout [/editor]', () => {
  test('an uncapped editor adds no scroll container and a wheel over it scrolls the page', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, 1);
    const editor = scope.locator('mlv-editor');
    expect(await scrollBarriers(editor, 'mlv-editor')).toEqual([]);

    const before = await pageScrollTop(mlv);
    await wheelOver(mlv, editor.locator('.mlv-editor__viewport'), 400);
    await expect.poll(() => pageScrollTop(mlv)).toBeGreaterThan(before + 100);
  });

  test('maxHeight caps the surface and makes the viewport the only scroller', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Maximum height', '240 px');
    const editor = scope.locator('mlv-editor');
    await expect(editor).toHaveClass(/mlv-editor--capped/);

    const surface = editor.locator('.mlv-editor__surface');
    const viewport = editor.locator('.mlv-editor__viewport');
    await expect
      .poll(async () => (await surface.boundingBox())?.height ?? 0)
      .toBeLessThanOrEqual(240.5);
    expect(
      await viewport.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          overflowY: style.overflowY,
          overscroll: style.overscrollBehaviorY,
        };
      }),
    ).toEqual({ overflowY: 'auto', overscroll: 'contain' });

    // Re-measure and re-wheel per attempt: the `@defer (on viewport)` examples
    // above can still resolve and shift the page between the measurement and
    // the wheel, which then lands outside this 240px box.
    await expect(async () => {
      await wheelOver(mlv, viewport, 200);
      expect(
        await viewport.evaluate((element) => element.scrollTop),
      ).toBeGreaterThan(0);
    }).toPass();
  });

  test('zoom reflows an uncapped editor: it grows, adds no scroller, and the wheel still scrolls the page', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, TABLE_ZOOM_EXAMPLE);
    const editor = scope.locator('mlv-editor');
    const viewport = editor.locator('.mlv-editor__viewport');
    const heightAt100 = (await viewport.boundingBox())?.height ?? 0;

    await scope.getByRole('button', { name: '125%' }).click();
    await expect
      .poll(() =>
        editor.evaluate((host) =>
          getComputedStyle(host).getPropertyValue('--mlv-editor-zoom').trim(),
        ),
      )
      .toBe('1.25');
    // The content's 8rem floor lives inside the zoomed layer, so the
    // viewport has to grow once zoom affects layout.
    await expect
      .poll(async () => (await viewport.boundingBox())?.height ?? 0)
      .toBeGreaterThan(heightAt100 * 1.1);
    const geometry = await viewport.evaluate((element) => ({
      viewWidth: (
        element.querySelector('.mlv-editor__view') as HTMLElement
      ).getBoundingClientRect().width,
      clientWidth: element.clientWidth,
    }));
    expect(geometry.viewWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(await scrollBarriers(editor, 'mlv-editor')).toEqual([]);

    const before = await pageScrollTop(mlv);
    await wheelOver(mlv, viewport, 400);
    await expect.poll(() => pageScrollTop(mlv)).toBeGreaterThan(before + 100);
  });

  test('a click at 125% zoom puts the caret under the pointer', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, TABLE_ZOOM_EXAMPLE);
    await scope.getByRole('button', { name: '125%' }).click();
    const paragraph = scope.locator('mlv-editor .ProseMirror p').first();
    const point = await paragraph.evaluate((element) => {
      const text = element.firstChild as Text;
      const range = document.createRange();
      range.setStart(text, 10);
      range.setEnd(text, 11);
      const rect = range.getBoundingClientRect();
      return {
        x: rect.left + rect.width * 0.25,
        y: rect.top + rect.height / 2,
      };
    });
    await mlv.page.mouse.click(point.x, point.y);
    await expect
      .poll(() => mlv.page.evaluate(() => getSelection()?.anchorOffset ?? -1))
      .toBe(10);
  });

  test('dragging a block at 125% zoom keeps the drag image to scale and adds no scroller', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, TABLE_ZOOM_EXAMPLE);
    await scope.getByRole('button', { name: 'Insert 3 × 3 table' }).click();
    await scope.getByRole('button', { name: '125%' }).click();
    const editor = scope.locator('mlv-editor');
    const first = editor.locator('.ProseMirror > *').first();
    // The source's on-screen height, read before the drag. The drag's own
    // `mlv-editor__block--dragging` class cannot be the handle for it: in a
    // real browser ProseMirror re-renders the block on that class mutation
    // (see the follow-up in the #416 report), so the element carrying it is
    // detached before the first `dragover`.
    const sourceHeight = (await first.boundingBox())?.height ?? 0;
    expect(sourceHeight).toBeGreaterThan(0);
    // Records one measurement at the first `dragover`, while the ghost exists;
    // it is removed at `dragend`.
    await editor.evaluate((host) => {
      const probeWindow = window as typeof window & {
        __mlvDragProbe?: { cloneHeight: number; barriers: string[] };
      };
      document.addEventListener(
        'dragover',
        () => {
          if (probeWindow.__mlvDragProbe) return;
          const clone = document.querySelector(
            '.mlv-editor__drag-ghost > *',
          ) as HTMLElement | null;
          if (!clone) return;
          const barriers: string[] = [];
          let element: Element | null = host.querySelector(
            '.mlv-editor__viewport',
          );
          while (element && element !== host) {
            const style = getComputedStyle(element);
            if (
              [style.overflowX, style.overflowY].some((value) =>
                ['auto', 'scroll', 'hidden'].includes(value),
              )
            ) {
              barriers.push(element.className);
            }
            element = element.parentElement;
          }
          probeWindow.__mlvDragProbe = {
            cloneHeight: clone.getBoundingClientRect().height,
            barriers,
          };
        },
        { capture: true },
      );
    });

    await first.hover();
    const handle = editor.locator(
      '.mlv-editor__block-handle[data-visible="true"]',
    );
    await expect(handle).toBeVisible();
    const handleBox = await handle.boundingBox();
    const lastBox = await editor
      .locator('.ProseMirror > *')
      .last()
      .boundingBox();
    if (!handleBox || !lastBox) throw new Error('Expected handle and target.');
    const x = handleBox.x + handleBox.width / 2;
    const y = handleBox.y + handleBox.height / 2;
    await mlv.page.mouse.move(x, y);
    await mlv.page.mouse.down();
    // Past Chromium's drag threshold while still over the handle. Chromium
    // re-hit-tests the press point when the drag starts, and the handle
    // follows the hovered block, so one long first step lands on the next
    // block and starts no drag at all.
    await mlv.page.mouse.move(x + 6, y + 6, { steps: 3 });
    await mlv.page.mouse.move(x, lastBox.y + lastBox.height - 4, { steps: 8 });
    await mlv.page.mouse.up();

    const probe = await mlv.page.evaluate(
      () =>
        (
          window as typeof window & {
            __mlvDragProbe?: { cloneHeight: number; barriers: string[] };
          }
        ).__mlvDragProbe,
    );
    expect(probe).toBeTruthy();
    // The ghost wrapper is `scale: 0.85` (editor.scss drag-ghost), so a clone
    // at the source's on-screen size reads 0.85. About 1.06 (1.25 × 0.85)
    // would mean the clone carried the ancestor zoom twice.
    expect((probe?.cloneHeight ?? 0) / sourceHeight).toBeCloseTo(0.85, 1);
    expect(probe?.barriers).toEqual([]);
  });

  test('zoom magnifies a capped editor inside its own scroller', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Maximum height', '240 px');
    const editor = scope.locator('mlv-editor');
    // CSS-level override: example 12 has no zoom buttons, and this asserts
    // the stylesheet's capped rule, not the zoom control.
    await editor.evaluate((host) =>
      host.style.setProperty('--mlv-editor-zoom', '1.5'),
    );
    const geometry = await editor
      .locator('.mlv-editor__viewport')
      .evaluate((element) => ({
        viewWidth: (
          element.querySelector('.mlv-editor__view') as HTMLElement
        ).getBoundingClientRect().width,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
    expect(geometry.viewWidth).toBeCloseTo(geometry.clientWidth * 1.5, -1);
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
  });

  test('a cap below the toolbar plus the min-height floor shrinks the viewport instead of clipping it', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    // `24 rem` puts the real `maxHeight` input on, so `--capped` is the
    // component's own; the inline write below is exactly the CSS that
    // `[maxHeight]="120"` binds (`_maxHeightStyle()` → `120px`). The example
    // offers no preset that small.
    await pick(scope, 'Maximum height', '24 rem');
    const editor = scope.locator('mlv-editor');
    await expect(editor).toHaveClass(/mlv-editor--capped/);

    const cases = [
      { position: 'Top', appearance: 'Bar', cap: '120px', floor: null },
      { position: 'Top', appearance: 'Floating', cap: '120px', floor: null },
      { position: 'Bottom', appearance: 'Bar', cap: '120px', floor: null },
      { position: 'Bottom', appearance: 'Floating', cap: '120px', floor: null },
      // An explicit minHeight above the cap: the cap still wins.
      { position: 'Top', appearance: 'Bar', cap: '150px', floor: '300px' },
    ];
    for (const { position, appearance, cap, floor } of cases) {
      const label = `${position} ${appearance}, max ${cap}, min ${floor ?? 'default'}`;
      await pick(scope, 'Toolbar position', position);
      await pick(scope, 'Toolbar appearance', appearance);
      await editor.evaluate(
        (host, [maxHeight, minHeight]) => {
          host.style.setProperty('--mlv-editor-max-height', maxHeight);
          if (minHeight)
            host.style.setProperty('--mlv-editor-min-height', minHeight);
          else host.style.removeProperty('--mlv-editor-min-height');
        },
        [cap, floor] as const,
      );

      await expect(async () => {
        const geometry = await editor.evaluate((host) => {
          const rect = (selector: string) => {
            const box = (
              host.querySelector(selector) as HTMLElement
            ).getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, height: box.height };
          };
          const viewport = host.querySelector(
            '.mlv-editor__viewport',
          ) as HTMLElement;
          return {
            surface: rect('.mlv-editor__surface'),
            band: rect('.mlv-editor__toolbar-band'),
            viewport: rect('.mlv-editor__viewport'),
            content: rect('.mlv-editor__content'),
            scrolls: viewport.scrollHeight > viewport.clientHeight,
          };
        });
        const { surface } = geometry;
        expect(surface.height, label).toBeLessThanOrEqual(
          Number.parseFloat(cap) + 0.5,
        );
        for (const part of ['band', 'viewport'] as const) {
          expect(
            geometry[part].top,
            `${label}: ${part} top`,
          ).toBeGreaterThanOrEqual(surface.top - 0.5);
          expect(
            geometry[part].bottom,
            `${label}: ${part} bottom`,
          ).toBeLessThanOrEqual(surface.bottom + 0.5);
        }
        expect(geometry.scrolls, `${label}: viewport scrolls`).toBe(true);
        if (floor) {
          expect(
            geometry.content.height,
            `${label}: content keeps the floor`,
          ).toBeGreaterThanOrEqual(Number.parseFloat(floor));
        }
      }).toPass();
    }
  });

  test('zooming out a short capped editor keeps the min-height floor', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Maximum height', '24 rem');
    const editor = scope.locator('mlv-editor');
    await expect(editor).toHaveClass(/mlv-editor--capped/);
    await editor.locator('.mlv-editor__content').click();
    await mlv.page.keyboard.press('ControlOrMeta+a');
    await mlv.page.keyboard.press('Backspace');

    const floor = await resolvedLength(
      editor,
      'var(--mlv-editor-min-height, 8rem)',
    );
    // CSS-level override, as in the capped zoom test above: example 12 has no
    // zoom buttons. The floor sits inside the zoomed view under a cap, so it
    // must not shrink with the zoom.
    await editor.evaluate((host) =>
      host.style.setProperty('--mlv-editor-zoom', '0.5'),
    );
    const viewport = editor.locator('.mlv-editor__viewport');
    await expect
      .poll(async () => (await viewport.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(floor - 0.5);
  });

  test('the floating pill is the token tall and never covers the first line at scroll 0, at every density', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    const editor = scope.locator('mlv-editor');
    for (const cap of ['Auto', '240 px']) {
      await pick(scope, 'Maximum height', cap);
      for (const density of [
        'Compact density',
        'Comfortable density',
        'Spacious density',
      ]) {
        await scope.getByRole('radio', { name: density }).click();
        const geometry = await pillGeometry(editor);
        expect(geometry.pillHeight).toBeCloseTo(geometry.token, 0);
        expect(geometry.firstBlockTop).toBeGreaterThanOrEqual(
          geometry.pillBottom - 0.5,
        );
      }
    }
  });

  test('content scrolls beneath the floating pill, which stays on top', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    await pick(scope, 'Maximum height', '240 px');
    const editor = scope.locator('mlv-editor');
    // `elementFromPoint` answers `null` off screen, and the deferred examples
    // above can push this one below the fold after `gotoExample` scrolled.
    await editor.scrollIntoViewIfNeeded();
    await editor
      .locator('.mlv-editor__viewport')
      .evaluate((element) => (element.scrollTop = 120));
    const geometry = await pillGeometry(editor);
    expect(geometry.firstBlockTop).toBeLessThan(geometry.pillBottom);
    const pillOnTop = await editor.evaluate((host) => {
      const pill = host.querySelector('.mlv-editor__toolbar') as HTMLElement;
      const rect = pill.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return hit !== null && pill.contains(hit);
    });
    expect(pillOnTop).toBe(true);
  });

  test('a bottom floating pill mirrors: the last line is clear at the end of the scroll', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar position', 'Bottom');
    await pick(scope, 'Toolbar appearance', 'Floating');
    await pick(scope, 'Maximum height', '240 px');
    const editor = scope.locator('mlv-editor');
    await editor
      .locator('.mlv-editor__viewport')
      .evaluate((element) => (element.scrollTop = element.scrollHeight));
    const geometry = await pillGeometry(editor);
    expect(geometry.lastBlockBottom).toBeLessThanOrEqual(
      geometry.pillTop + 0.5,
    );
  });

  test('the pill centres itself in both directions', async ({ mlv }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    const editor = scope.locator('mlv-editor');
    for (const direction of ['LTR', 'RTL']) {
      await scope
        .locator('[data-switcher="direction"]')
        .getByRole('radio', { name: direction })
        .click();
      await expect
        .poll(() => editor.evaluate((host) => getComputedStyle(host).direction))
        .toBe(direction.toLowerCase());
      const geometry = await pillGeometry(editor);
      expect(
        Math.abs(geometry.pillCenter - geometry.bandCenter),
      ).toBeLessThanOrEqual(1);
    }
  });

  test('a floating toolbar follows the surface width, not its own: it narrows, holds, and widens again', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    const toolbar = scope
      .locator('mlv-editor')
      .getByRole('toolbar', { name: 'Editor toolbar' });
    await scope.getByRole('radio', { name: 'Mobile width' }).click();
    await expect(toolbar).toHaveClass(/mlv-editor-toolbar--narrow/);
    await mlv.page.waitForTimeout(500);
    await expect(toolbar).toHaveClass(/mlv-editor-toolbar--narrow/);
    // The circular case: a narrow pill hugs its fewer controls, so a pill that
    // measured itself would stay below the threshold after the surface grows.
    await scope.getByRole('radio', { name: 'Full width' }).click();
    await expect(toolbar).not.toHaveClass(/mlv-editor-toolbar--narrow/);
  });

  test('a sticky top toolbar pins under the offset while the editor is on screen and releases after it', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await setSticky(scope, true);
    const editor = scope.locator('mlv-editor');
    expect(await scrollBarriers(editor, 'docs-example-container')).toEqual([]);
    const offset = await resolvedLength(
      editor,
      'var(--mlv-editor-toolbar-sticky-offset, 0)',
    );

    await editor.evaluate((host, top) => {
      const surface = host.querySelector('.mlv-editor__surface') as HTMLElement;
      (document.scrollingElement ?? document.documentElement).scrollBy({
        top: surface.getBoundingClientRect().top - top + 200,
        behavior: 'instant',
      });
    }, offset);
    const pinned = await editor.evaluate((host) => ({
      band: (
        host.querySelector('.mlv-editor__toolbar-band') as HTMLElement
      ).getBoundingClientRect().top,
      surface: (
        host.querySelector('.mlv-editor__surface') as HTMLElement
      ).getBoundingClientRect().top,
    }));
    expect(pinned.surface).toBeLessThan(offset - 100);
    expect(Math.abs(pinned.band - offset)).toBeLessThanOrEqual(1);

    await editor.evaluate((host) => {
      const surface = host.querySelector('.mlv-editor__surface') as HTMLElement;
      (document.scrollingElement ?? document.documentElement).scrollBy({
        top: surface.getBoundingClientRect().bottom + 50,
        behavior: 'instant',
      });
    });
    const released = await editor.evaluate((host) => ({
      bandBottom: (
        host.querySelector('.mlv-editor__toolbar-band') as HTMLElement
      ).getBoundingClientRect().bottom,
      surfaceBottom: (
        host.querySelector('.mlv-editor__surface') as HTMLElement
      ).getBoundingClientRect().bottom,
    }));
    expect(released.bandBottom).toBeLessThanOrEqual(
      released.surfaceBottom + 0.5,
    );
  });

  test('a sticky bottom floating toolbar pins to the page bottom and releases at the surface start', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar position', 'Bottom');
    await pick(scope, 'Toolbar appearance', 'Floating');
    await setSticky(scope, true);
    // The example's surface is about 900px tall, so a 1000px viewport can
    // never hold its start on screen with its end 100px below the fold.
    await mlv.page.setViewportSize({ width: 1600, height: 700 });
    const editor = scope.locator('mlv-editor');
    const viewportHeight = await mlv.page.evaluate(() => window.innerHeight);

    await editor.evaluate((host) => {
      const surface = host.querySelector('.mlv-editor__surface') as HTMLElement;
      (document.scrollingElement ?? document.documentElement).scrollBy({
        top: surface.getBoundingClientRect().top - 150,
        behavior: 'instant',
      });
    });
    const pinned = await editor.evaluate((host) => ({
      bandBottom: (
        host.querySelector('.mlv-editor__toolbar-band') as HTMLElement
      ).getBoundingClientRect().bottom,
      surfaceBottom: (
        host.querySelector('.mlv-editor__surface') as HTMLElement
      ).getBoundingClientRect().bottom,
    }));
    expect(pinned.surfaceBottom).toBeGreaterThan(viewportHeight + 100);
    expect(Math.abs(pinned.bandBottom - viewportHeight)).toBeLessThanOrEqual(1);
  });

  for (const side of ['top', 'bottom'] as const) {
    test(`the caret never ends under a ${side} floating pill in a capped editor`, async ({
      mlv,
    }) => {
      const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
      if (side === 'bottom') await pick(scope, 'Toolbar position', 'Bottom');
      await pick(scope, 'Toolbar appearance', 'Floating');
      await pick(scope, 'Maximum height', '240 px');
      const result = await enterUnderToolbar(
        mlv,
        scope.locator('mlv-editor'),
        side,
        'viewport',
      );
      if (side === 'top') {
        expect(result.blockTop).toBeGreaterThanOrEqual(result.pillBottom - 0.5);
      } else {
        expect(result.blockBottom).toBeLessThanOrEqual(result.pillTop + 0.5);
      }
    });
  }

  test('the caret never ends under a page-sticky toolbar', async ({ mlv }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await setSticky(scope, true);
    const result = await enterUnderToolbar(
      mlv,
      scope.locator('mlv-editor'),
      'top',
      'page',
    );
    expect(result.blockTop).toBeGreaterThanOrEqual(result.bandBottom - 0.5);
  });
});
