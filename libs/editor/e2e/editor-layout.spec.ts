import { expect, test, type MlvE2ePage } from '@malva-ui/cdk/testing-e2e';
import type { Locator } from '@playwright/test';
import { editorManifest } from './editor.manifest';

/** `/editor` "Layout" example (position, appearance, max height, sticky). */
const LAYOUT_EXAMPLE = 12;
/** `/editor` "Tables and independent view zoom" example (80 / 100 / 125 %). */
const TABLE_ZOOM_EXAMPLE = 8;
/** `/editor` "State and event boundary" example (readonly / disabled toggles). */
const READONLY_EXAMPLE = 6;

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

/**
 * The `'floating'` bubble's pane. `/editor` example 14's clean editor keeps
 * its own bubble pane attached too; only the clean one holds the bubble
 * groups, which tells the two apart.
 */
const FLOATING_BUBBLE =
  '.cdk-overlay-pane.mlv-editor-bubble:not(:has(mlv-editor-bubble-groups))';

/** The selection bubble's CDK overlay pane, portaled to `<body>`. */
function bubblePane(mlv: MlvE2ePage): Locator {
  return mlv.page.locator(FLOATING_BUBBLE);
}

/**
 * Focuses the content and selects all text of paragraph `index` through the
 * DOM selection, which ProseMirror reads on `selectionchange`. With
 * `offsetFromViewportTop`, the capped viewport is first scrolled so the
 * paragraph's top sits that many px below the viewport's top edge; without
 * it, the page is scrolled to centre the paragraph, because the deferred
 * examples above can still shift the page after `gotoExample` and the bubble
 * hides for a selection outside the window.
 */
async function selectParagraph(
  editor: Locator,
  index: number,
  offsetFromViewportTop: number | null = null,
) {
  await editor.evaluate(
    (host, [paragraphIndex, offset]) => {
      const content = host.querySelector('.ProseMirror') as HTMLElement;
      content.focus({ preventScroll: true });
      const paragraph =
        content.querySelectorAll<HTMLElement>(':scope > p')[paragraphIndex];
      if (offset !== null) {
        const viewport = host.querySelector(
          '.mlv-editor__viewport',
        ) as HTMLElement;
        viewport.scrollTop +=
          paragraph.getBoundingClientRect().top -
          (viewport.getBoundingClientRect().top + offset);
      } else {
        paragraph.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    [index, offsetFromViewportTop] as const,
  );
}

/**
 * The bubble pane's rect against the DOM selection's, once the enter
 * animation (an opacity fade, which moves nothing) has finished, plus where
 * focus is.
 */
async function bubbleGeometry(mlv: MlvE2ePage) {
  return mlv.page.evaluate(async (selector) => {
    const pane = document.querySelector(selector) as HTMLElement;
    await Promise.all(
      pane
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    const paneRect = pane.getBoundingClientRect();
    const selection = getSelection();
    const selectionRect =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).getBoundingClientRect()
        : null;
    return {
      paneTop: paneRect.top,
      paneBottom: paneRect.bottom,
      paneLeft: paneRect.left,
      paneRight: paneRect.right,
      paneCenter: paneRect.left + paneRect.width / 2,
      below: pane.classList.contains('mlv-editor-bubble--below'),
      selectionTop: selectionRect?.top ?? Number.NaN,
      selectionBottom: selectionRect?.bottom ?? Number.NaN,
      selectionCenter: selectionRect
        ? selectionRect.left + selectionRect.width / 2
        : Number.NaN,
      windowWidth: window.innerWidth,
      focusInContent: !!document.activeElement?.closest('.ProseMirror'),
    };
  }, FLOATING_BUBBLE);
}

/** ProseMirror's own selection, read off the Tiptap instance on the view DOM. */
async function editorSelection(editor: Locator) {
  return editor.evaluate((host) => {
    const content = host.querySelector('.ProseMirror') as HTMLElement & {
      editor?: { state: { selection: { from: number; to: number } } };
    };
    const selection = content.editor?.state.selection;
    return { from: selection?.from ?? -1, to: selection?.to ?? -1 };
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
 * rect next to the band's.
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
    const band = (
      host.querySelector('.mlv-editor__toolbar-band') as HTMLElement
    ).getBoundingClientRect();
    return {
      blockTop: block?.top ?? Number.NaN,
      blockBottom: block?.bottom ?? Number.NaN,
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
    await expect
      .poll(() =>
        scope
          .locator('mlv-editor')
          .evaluate((host) =>
            getComputedStyle(host).getPropertyValue('--mlv-editor-zoom').trim(),
          ),
      )
      .toBe('1.25');
    const paragraph = scope.locator('mlv-editor .ProseMirror p').first();
    // Deferred examples above can still shift the page; measure on screen.
    await paragraph.scrollIntoViewIfNeeded();
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
    // The source's on-screen height, read before the drag: ProseMirror
    // replaces top-level elements while a block is dragged, so a locator
    // resolved now may name a detached element by the first `dragover`.
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
    // The ghost is drawn at the block's own size (editor.scss drag-ghost has
    // no scale), so a clone at the source's on-screen size reads 1. About
    // 1.25 would mean the clone carried the ancestor zoom twice.
    expect((probe?.cloneHeight ?? 0) / sourceHeight).toBeCloseTo(1, 1);
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

    // Bar only: the floating bubble is an overlay, not part of the surface.
    const cases = [
      { position: 'Top', cap: '120px', floor: null },
      { position: 'Bottom', cap: '120px', floor: null },
      // An explicit minHeight above the cap: the cap still wins.
      { position: 'Top', cap: '150px', floor: '300px' },
    ];
    for (const { position, cap, floor } of cases) {
      const label = `${position} bar, max ${cap}, min ${floor ?? 'default'}`;
      await pick(scope, 'Toolbar position', position);
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

  test('a floating toolbar follows the surface width, not its own: it narrows, holds, and widens again', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    // The bubble's toolbar is portaled and hidden until a selection exists,
    // but its view stays attached, so its class is readable throughout.
    const toolbar = mlv.page.locator(`${FLOATING_BUBBLE} .mlv-editor__toolbar`);
    await scope.getByRole('radio', { name: 'Mobile width' }).click();
    await expect(toolbar).toHaveClass(/mlv-editor-toolbar--narrow/);
    await mlv.page.waitForTimeout(500);
    await expect(toolbar).toHaveClass(/mlv-editor-toolbar--narrow/);
    // The circular case: a narrow bubble hugs its fewer controls, so a bubble
    // that measured itself would stay below the threshold after the surface
    // grows.
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

  test('a sticky bottom bar pins to the page bottom and releases at the surface start', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar position', 'Bottom');
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

  test('the example disables Sticky where it has no effect', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    // The reason is the switch's own `description`, so it reaches assistive
    // technology through `aria-describedby`, not only the eye.
    const toggle = scope.getByRole('switch', { name: 'Sticky toolbar' });
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAccessibleDescription('');

    await pick(scope, 'Maximum height', '240 px');
    await expect(toggle).toBeDisabled();
    await expect(toggle).toHaveAccessibleDescription(
      'No effect under a height cap.',
    );

    await pick(scope, 'Maximum height', 'Auto');
    await pick(scope, 'Toolbar appearance', 'Floating');
    await expect(toggle).toBeDisabled();
    await expect(toggle).toHaveAccessibleDescription(
      'The floating bubble follows the selection instead.',
    );
  });

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

  test('readonly removes the bar and its space, moves focus from it to the content, and restores it after', async ({
    mlv,
  }) => {
    // #498: a readonly editor renders no toolbar.
    const scope = await gotoExample(mlv, READONLY_EXAMPLE);
    const editor = scope.locator('mlv-editor');
    const band = editor.locator('.mlv-editor__toolbar-band');
    const content = editor.locator('.ProseMirror');
    // `element.click()` activates the toggle without moving focus, so focus is
    // still on the toolbar control when the band goes away.
    const toggleReadonly = () =>
      scope
        .getByRole('button', { name: /^Readonly:/ })
        .evaluate((button: HTMLElement) => button.click());
    const viewportOffset = () =>
      editor.evaluate((host) => {
        const surface = host.querySelector('.mlv-editor__surface') as Element;
        const viewport = host.querySelector('.mlv-editor__viewport') as Element;
        return (
          viewport.getBoundingClientRect().top -
          surface.getBoundingClientRect().top
        );
      });

    await expect(band).toHaveCount(1);
    const editableOffset = await viewportOffset();
    expect(editableOffset).toBeGreaterThan(30);
    // Undo / redo are natively disabled on a fresh document and take no focus.
    const control = band.locator('button:enabled').first();
    await control.focus();
    await expect(control).toBeFocused();

    await toggleReadonly();
    await expect(band).toHaveCount(0);
    await expect(editor.getByRole('toolbar')).toHaveCount(0);
    await expect(content).toBeFocused();
    // Only the surface's own border sits above the viewport now.
    expect(await viewportOffset()).toBeLessThan(4);

    await toggleReadonly();
    await expect(band).toHaveCount(1);
    await expect(editor.getByRole('toolbar')).toHaveCount(1);
    expect(await viewportOffset()).toBeCloseTo(editableOffset, 0);
  });
});

test.describe('Editor selection bubble [/editor]', () => {
  test('shows above a non-empty selection without taking focus, and hides on a bare caret', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    const editor = scope.locator('mlv-editor');
    const pane = bubblePane(mlv);
    await expect(editor.locator('.mlv-editor__toolbar-band')).toHaveCount(0);

    await editor.locator('.ProseMirror > p').nth(3).click();
    await expect(pane).toHaveClass(/mlv-editor-bubble--hidden/);

    await selectParagraph(editor, 3);
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--hidden/);
    await expect(
      pane.getByRole('toolbar', { name: 'Editor toolbar' }),
    ).toBeVisible();
    const geometry = await bubbleGeometry(mlv);
    expect(geometry.below).toBe(false);
    const gap = geometry.selectionTop - geometry.paneBottom;
    expect(gap).toBeGreaterThanOrEqual(7);
    expect(gap).toBeLessThanOrEqual(9);
    // Centred on the selection unless the window's margin pushed it.
    if (
      geometry.paneLeft > 8.5 &&
      geometry.paneRight < geometry.windowWidth - 8.5
    ) {
      expect(
        Math.abs(geometry.paneCenter - geometry.selectionCenter),
      ).toBeLessThanOrEqual(1);
    }
    expect(geometry.focusInContent).toBe(true);

    await mlv.page.keyboard.press('ArrowRight');
    await expect(pane).toHaveClass(/mlv-editor-bubble--hidden/);
  });

  test("flips below at a capped scroller's top edge, tracks its scroll, and hides once the selection leaves it", async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    await pick(scope, 'Maximum height', '240 px');
    const editor = scope.locator('mlv-editor');
    await expect(editor).toHaveClass(/mlv-editor--capped/);
    // Leave room above the editor in the window, so only the capped
    // viewport's own top edge can force the flip.
    await editor.evaluate((host) => {
      (document.scrollingElement ?? document.documentElement).scrollBy({
        top: host.getBoundingClientRect().top - 400,
        behavior: 'instant',
      });
    });
    expect(
      await editor.evaluate((host) => host.getBoundingClientRect().top),
    ).toBeGreaterThan(200);

    const pane = bubblePane(mlv);
    const viewport = editor.locator('.mlv-editor__viewport');
    await selectParagraph(editor, 8, 4);
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--hidden/);
    await expect(pane).toHaveClass(/mlv-editor-bubble--below/);
    const flipped = await bubbleGeometry(mlv);
    expect(flipped.paneTop - flipped.selectionBottom).toBeGreaterThanOrEqual(7);
    expect(flipped.paneTop - flipped.selectionBottom).toBeLessThanOrEqual(9);

    // Scrolling the viewport moves the selection 30px down; still no room
    // above, so the bubble stays below and moves with it.
    await viewport.evaluate((element) => (element.scrollTop -= 30));
    await expect(async () => {
      const tracked = await bubbleGeometry(mlv);
      expect(tracked.selectionBottom).toBeCloseTo(
        flipped.selectionBottom + 30,
        0,
      );
      expect(tracked.below).toBe(true);
      expect(tracked.paneTop - tracked.selectionBottom).toBeGreaterThanOrEqual(
        7,
      );
      expect(tracked.paneTop - tracked.selectionBottom).toBeLessThanOrEqual(9);
    }).toPass();

    // Far enough down that the bubble fits above again: it flips back.
    await viewport.evaluate((element) => (element.scrollTop -= 120));
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--below/);
    const above = await bubbleGeometry(mlv);
    expect(above.selectionTop - above.paneBottom).toBeGreaterThanOrEqual(7);
    expect(above.selectionTop - above.paneBottom).toBeLessThanOrEqual(9);

    // Scrolled out of the capped viewport: nothing to point at.
    await viewport.evaluate((element) => (element.scrollTop += 400));
    await expect(pane).toHaveClass(/mlv-editor-bubble--hidden/);
    await viewport.evaluate((element) => (element.scrollTop -= 400));
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--hidden/);
  });

  test('Alt+F10 moves focus into the bubble, even at a bare caret; Escape returns it with the selection intact', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    const editor = scope.locator('mlv-editor');
    const pane = bubblePane(mlv);
    const toolbar = pane.getByRole('toolbar', { name: 'Editor toolbar' });
    const focusInToolbar = () =>
      toolbar.evaluate((element) => element.contains(document.activeElement));
    const focusInContent = () =>
      editor.evaluate((host) =>
        host.querySelector('.ProseMirror')?.contains(document.activeElement),
      );

    await selectParagraph(editor, 5);
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--hidden/);
    const selected = await editorSelection(editor);
    expect(selected.to).toBeGreaterThan(selected.from);
    await mlv.page.keyboard.press('Alt+F10');
    await expect.poll(focusInToolbar).toBe(true);
    await mlv.page.keyboard.press('Escape');
    await expect.poll(focusInContent).toBe(true);
    expect(await editorSelection(editor)).toEqual(selected);
    await expect(pane).toHaveClass(/mlv-editor-bubble--hidden/);

    await editor.locator('.ProseMirror > p').nth(3).click();
    await expect(pane).toHaveClass(/mlv-editor-bubble--hidden/);
    const caret = await editorSelection(editor);
    await mlv.page.keyboard.press('Alt+F10');
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--hidden/);
    await expect.poll(focusInToolbar).toBe(true);
    await mlv.page.keyboard.press('Escape');
    await expect.poll(focusInContent).toBe(true);
    expect(await editorSelection(editor)).toEqual(caret);
    await expect(pane).toHaveClass(/mlv-editor-bubble--hidden/);
  });

  test('Escape in the content hides the bubble and goes no further; focus and the selection stay', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    const editor = scope.locator('mlv-editor');
    const content = editor.locator('.ProseMirror');
    const pane = bubblePane(mlv);
    await expect(content).toHaveAttribute('aria-keyshortcuts', 'Alt+F10');
    // Counts the Escapes that reach the document, where a CDK dialog's
    // keyboard dispatcher listens. ProseMirror cancels every Escape it
    // handles, so this is the real browser path a DOM listener missed.
    await mlv.page.evaluate(() => {
      const record = window as unknown as { mlvEscapes: number };
      record.mlvEscapes = 0;
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') record.mlvEscapes += 1;
      });
    });
    const escapesAtDocument = () =>
      mlv.page.evaluate(
        () => (window as unknown as { mlvEscapes: number }).mlvEscapes,
      );

    await selectParagraph(editor, 5);
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--hidden/);
    const selected = await editorSelection(editor);
    expect(selected.to).toBeGreaterThan(selected.from);

    await mlv.page.keyboard.press('Escape');
    await expect(pane).toHaveClass(/mlv-editor-bubble--hidden/);
    expect(
      await content.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    expect(await editorSelection(editor)).toEqual(selected);
    expect(await escapesAtDocument()).toBe(0);

    // Hidden, the bubble claims nothing: the next Escape reaches the page.
    await mlv.page.keyboard.press('Escape');
    expect(await escapesAtDocument()).toBe(1);
    await expect(pane).toHaveClass(/mlv-editor-bubble--hidden/);
  });

  test('Bold in the bubble applies to a mouse selection, which stays, with the bubble still shown', async ({
    mlv,
  }) => {
    const scope = await gotoExample(mlv, LAYOUT_EXAMPLE);
    await pick(scope, 'Toolbar appearance', 'Floating');
    const editor = scope.locator('mlv-editor');
    const paragraph = editor.locator('.ProseMirror > p').nth(6);
    const pane = bubblePane(mlv);
    const bold = pane.getByRole('button', { name: 'Bold' });

    // Measured right after centring the line, because the deferred examples
    // above can still shift the page.
    const line = await paragraph.evaluate((element) => {
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getClientRects()[0];
      return {
        start: rect.left + 2,
        end: rect.right - 2,
        middle: rect.top + rect.height / 2,
      };
    });
    await mlv.page.mouse.move(line.start, line.middle);
    await mlv.page.mouse.down();
    await mlv.page.mouse.move(line.end, line.middle, { steps: 8 });
    await mlv.page.mouse.up();
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--hidden/);
    const selected = await editorSelection(editor);
    expect(selected.to).toBeGreaterThan(selected.from);

    // A press on the bubble between its controls leaves focus in the content.
    await pane.locator('.mlv-editor-toolbar__separator').first().click();
    expect(
      await editor.evaluate((host) =>
        host.querySelector('.ProseMirror')?.contains(document.activeElement),
      ),
    ).toBe(true);
    expect(await editorSelection(editor)).toEqual(selected);
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--hidden/);

    await bold.click();
    await expect(paragraph.locator('strong')).toHaveCount(1);
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    expect(await editorSelection(editor)).toEqual(selected);
    await expect(pane).not.toHaveClass(/mlv-editor-bubble--hidden/);
  });
});
