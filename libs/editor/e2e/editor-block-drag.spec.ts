import { expect, test, type MlvE2ePage } from '@malva-ui/cdk/testing-e2e';
import type { Locator } from '@playwright/test';
import { editorManifest } from './editor.manifest';

/**
 * `/editor` "Layout" example: a heading followed by `Change 1` … `Change 24`,
 * one short paragraph each, so every gap is a plain paragraph margin.
 */
const LAYOUT_EXAMPLE = 12;

/** Block being dragged (`Change 2`) and the gap it is dropped into. */
const SOURCE_INDEX = 2;
const PREVIOUS_PREFIX = 'Change 4:';
const NEXT_PREFIX = 'Change 5:';

/** Top-level order after `Change 2` lands between `Change 4` and `Change 5`. */
const ORDER_AFTER_DROP = [
  'Release notes',
  'Change 1:',
  'Change 3:',
  'Change 4:',
  'Change 2:',
  'Change 5:',
  'Change 6:',
];

/** `/editor` "Tables and independent view zoom" example (80 / 100 / 125 %). */
const TABLE_ZOOM_EXAMPLE = 8;

/** What the drag image handed to `setDragImage` looked like at that call. */
interface MlvDragImageRecord {
  readonly x: number;
  readonly y: number;
  /** Rendered box, CSS `zoom` included. */
  readonly left: number;
  readonly right: number;
  /** Layout width, which leaves out the wrapper's own CSS `zoom`. */
  readonly offsetWidth: number;
}

type ProbeWindow = typeof window & { __mlvDragImage?: MlvDragImageRecord };

/**
 * Every live top-level block's box relative to the editor host, rounded to
 * 0.01px. Relative to the host so a page scroll moves nothing, while any
 * margin, padding, transform or size change on a block or around it does.
 */
async function blockGeometry(editor: Locator): Promise<number[][]> {
  return editor.evaluate((host) => {
    const frame = host.getBoundingClientRect();
    const round = (value: number) => Math.round(value * 100) / 100;
    return [...host.querySelectorAll('.ProseMirror > *')].map((element) => {
      const box = element.getBoundingClientRect();
      return [
        round(box.top - frame.top),
        round(box.bottom - frame.top),
        round(box.left - frame.left),
        round(box.right - frame.left),
      ];
    });
  });
}

async function gotoLayout(
  mlv: MlvE2ePage,
  direction: 'ltr' | 'rtl',
): Promise<Locator> {
  await mlv.page.setViewportSize({ width: 1280, height: 1000 });
  await mlv.goto(editorManifest.route);
  const scope = mlv.example(LAYOUT_EXAMPLE);
  // The example body is `@defer (on viewport)`.
  await scope.scrollIntoViewIfNeeded();
  const editor = scope.locator('mlv-editor');
  await expect(editor.locator('.ProseMirror > *')).toHaveCount(25);
  if (direction === 'rtl') {
    // A scoped `[dir]` right above the editor, the document staying LTR — the
    // case the drag image, portaled to `document.body`, cannot inherit. Not on
    // the example container: its stage carries its own `dir="ltr"`.
    await editor.evaluate((host) =>
      host.parentElement?.setAttribute('dir', 'rtl'),
    );
    await expect(editor.locator('.ProseMirror')).toHaveCSS('direction', 'rtl');
  }
  return editor;
}

/**
 * Records the element and offsets the plugin hands to `setDragImage`, read at
 * the call — the wrapper is removed at `dragend`. The rasterized image itself
 * is not observable from a page, so this pins the geometry it is built from.
 */
async function recordDragImage(mlv: MlvE2ePage): Promise<void> {
  await mlv.page.evaluate(() => {
    const original = DataTransfer.prototype.setDragImage;
    DataTransfer.prototype.setDragImage = function (
      this: DataTransfer,
      image: Element,
      x: number,
      y: number,
    ) {
      const rect = image.getBoundingClientRect();
      (window as ProbeWindow).__mlvDragImage = {
        x,
        y,
        left: rect.left,
        right: rect.right,
        offsetWidth: (image as HTMLElement).offsetWidth,
      };
      return original.call(this, image, x, y);
    };
  });
}

/**
 * Mid-drag state, read off the **live** document rather than a snapshot.
 * `before` is `blockGeometry` taken before the button went down.
 */
async function readDragState(editor: Locator, before: number[][]) {
  return editor.evaluate(
    (host, [sourcePrefix, previousPrefix, nextPrefix, baseline]) => {
      const live = [...host.querySelectorAll<HTMLElement>('.ProseMirror > *')];
      const frame = host.getBoundingClientRect();
      const round = (value: number) => Math.round(value * 100) / 100;
      const byPrefix = (prefix: string) => {
        const found = live.find((element) =>
          (element.textContent ?? '').startsWith(prefix),
        );
        if (!found) throw new Error(`No live block starts "${prefix}".`);
        return found;
      };
      const source = byPrefix(sourcePrefix);
      const previous = byPrefix(previousPrefix).getBoundingClientRect();
      const next = byPrefix(nextPrefix).getBoundingClientRect();
      const indicator = host.querySelector<HTMLElement>(
        '.mlv-editor__drop-indicator',
      );
      if (!indicator) throw new Error('Expected the drop indicator.');
      const line = indicator.getBoundingClientRect();
      const centre = line.top + line.height / 2;

      // The accent pale fill, resolved in the document scope the drag image
      // is rendered in.
      const swatch = document.createElement('div');
      swatch.style.backgroundColor = 'var(--mlv-background-accent-1-pale)';
      document.body.appendChild(swatch);
      const accentPale = getComputedStyle(swatch).backgroundColor;
      swatch.remove();
      const ghost = document.querySelector<HTMLElement>(
        '.mlv-editor__drag-ghost',
      );
      const ghostStyle = ghost ? getComputedStyle(ghost) : null;

      return {
        sourceDimmed: source.classList.contains('mlv-editor__block--dragging'),
        sourceOpacity: Number(getComputedStyle(source).opacity),
        // Blocks whose box moved or resized since before the drag, whatever
        // did it: a transform, a margin or padding, a class-driven layout
        // change. Compared by position, since nothing reorders mid-drag.
        moved:
          live.length === baseline.length
            ? live.flatMap((element, index) => {
                const box = element.getBoundingClientRect();
                const now = [
                  round(box.top - frame.top),
                  round(box.bottom - frame.top),
                  round(box.left - frame.left),
                  round(box.right - frame.left),
                ];
                return now.every(
                  (value, side) => value === baseline[index][side],
                )
                  ? []
                  : [(element.textContent ?? '').slice(0, 10)];
              })
            : [`block count ${baseline.length} -> ${live.length}`],
        indicatorVisible: indicator.getAttribute('data-visible'),
        indicatorInGap: centre > previous.bottom && centre < next.top,
        indicator: {
          centre: Math.round(centre * 10) / 10,
          previousBottom: Math.round(previous.bottom * 10) / 10,
          nextTop: Math.round(next.top * 10) / 10,
        },
        ghostTinted: ghostStyle?.backgroundColor === accentPale,
        ghostShadow: ghostStyle?.boxShadow ?? null,
      };
    },
    ['Change 2:', PREVIOUS_PREFIX, NEXT_PREFIX, before] as const,
  );
}

/** The table-and-zoom example at 125%, optionally under a scoped `dir="rtl"`. */
async function gotoZoomed(
  mlv: MlvE2ePage,
  direction: 'ltr' | 'rtl',
): Promise<Locator> {
  await mlv.page.setViewportSize({ width: 1600, height: 1000 });
  await mlv.goto(editorManifest.route);
  const scope = mlv.example(TABLE_ZOOM_EXAMPLE);
  await scope.scrollIntoViewIfNeeded();
  // A table gives the one-paragraph example blocks to drag between.
  await scope.getByRole('button', { name: 'Insert 3 × 3 table' }).click();
  await scope.getByRole('button', { name: '125%' }).click();
  const editor = scope.locator('mlv-editor');
  if (direction === 'rtl') {
    await editor.evaluate((host) =>
      host.parentElement?.setAttribute('dir', 'rtl'),
    );
    await expect(editor.locator('.ProseMirror')).toHaveCSS('direction', 'rtl');
  }
  return editor;
}

/** Leading text of every live top-level block, for the order assertion. */
async function blockOrder(editor: Locator): Promise<string[]> {
  return editor.locator('.ProseMirror > *').evaluateAll((elements) =>
    elements.map((element) => {
      const text = element.textContent ?? '';
      const colon = text.indexOf(':');
      return colon < 0 ? text : text.slice(0, colon + 1);
    }),
  );
}

for (const direction of ['ltr', 'rtl'] as const) {
  test.describe(`block drag (${direction})`, () => {
    test('dims the live source, draws the line in the natural gap and reflows nothing', async ({
      mlv,
    }) => {
      const editor = await gotoLayout(mlv, direction);
      await recordDragImage(mlv);
      const blocks = editor.locator('.ProseMirror > *');
      const source = blocks.nth(SOURCE_INDEX);
      await source.evaluate((element) =>
        element.scrollIntoView({ block: 'center' }),
      );

      // `scroll: 'none'` keeps the centring above. When the first hover attempt
      // finds the block "not stable" (the route's last 1px settle), Playwright
      // retries with a forced `scrollIntoView({ block: 'end' })`, which pins
      // `Change 2` to the viewport's bottom edge and pushes the drop target
      // below it — measured on Playwright 1.63 / Chromium 153 in about one run
      // in four. The stability wait still runs; only the scroll is skipped.
      await source.hover({ scroll: 'none' });
      const handle = editor.locator(
        '.mlv-editor__block-handle[data-visible="true"]',
      );
      await expect(handle).toHaveAttribute('data-index', String(SOURCE_INDEX));
      const handleBox = await handle.boundingBox();
      if (!handleBox) throw new Error('Expected the handle.');
      const x = handleBox.x + handleBox.width / 2;
      const y = handleBox.y + handleBox.height / 2;
      await mlv.page.mouse.move(x, y);
      const before = await blockGeometry(editor);

      await mlv.page.mouse.down();
      // Past Chromium's drag threshold while still over the handle: the handle
      // follows the hovered block, so a long first step would re-hit-test onto
      // another block and start no drag at all.
      await mlv.page.mouse.move(x + 3, y + 3, { steps: 3 });
      // Measured only now, as late as possible: the docs route keeps settling
      // after this example renders (measured: the editor host moves 2–24px
      // within ~350ms while other deferred examples render), and a target
      // measured before that would aim at the wrong gap.
      const targetBox = await blocks.nth(5).boundingBox();
      if (!targetBox) throw new Error('Expected the target block.');
      // The upper half of `Change 5`: the gap between `Change 4` and `Change 5`.
      await mlv.page.mouse.move(x, targetBox.y + targetBox.height * 0.3, {
        steps: 10,
      });

      // Polled because the line glides to its `top`; the other fields hold
      // from the first `dragover` on. `moved: []` is the owner's "no reflow":
      // every block keeps the box it had before the button went down.
      await expect
        .poll(() => readDragState(editor, before), { timeout: 3_000 })
        .toMatchObject({
          sourceDimmed: true,
          moved: [],
          indicatorVisible: 'true',
          indicatorInGap: true,
          ghostTinted: true,
          ghostShadow: 'none',
        });
      const state = await readDragState(editor, before);
      expect(state.sourceOpacity).toBeLessThan(0.75);

      // The pointer rides the drag image's inline-start edge — its right edge
      // under a scoped `dir="rtl"` — in the box the offset is resolved in.
      const image = await mlv.page.evaluate(
        () => (window as ProbeWindow).__mlvDragImage,
      );
      if (!image) throw new Error('Expected a setDragImage call.');
      expect(image.y).toBe(0);
      const anchor = image.left + image.x;
      expect(anchor).toBeCloseTo(
        direction === 'rtl' ? image.right : image.left,
        0,
      );

      await mlv.page.mouse.up();

      await expect
        .poll(async () =>
          (await blockOrder(editor)).slice(0, ORDER_AFTER_DROP.length),
        )
        .toEqual(ORDER_AFTER_DROP);
      await expect(editor.locator('.mlv-editor__block--dragging')).toHaveCount(
        0,
      );
      await expect(editor.locator('.ProseMirror--block-dragging')).toHaveCount(
        0,
      );
      await expect(
        editor.locator('.mlv-editor__drop-indicator'),
      ).toHaveAttribute('data-visible', 'false');
      await expect(mlv.page.locator('.mlv-editor__drag-ghost')).toHaveCount(0);
      expect(
        await blocks.evaluateAll(
          (elements) =>
            elements.filter(
              (element) => (element as HTMLElement).style.transform,
            ).length,
        ),
      ).toBe(0);
    });

    test('anchors the drag image on its rendered inline-start edge at 125% zoom', async ({
      mlv,
    }) => {
      const editor = await gotoZoomed(mlv, direction);
      await recordDragImage(mlv);
      const first = editor.locator('.ProseMirror > *').first();
      await first.hover();
      const handle = editor.locator(
        '.mlv-editor__block-handle[data-visible="true"]',
      );
      await expect(handle).toHaveAttribute('data-index', '0');
      const handleBox = await handle.boundingBox();
      if (!handleBox) throw new Error('Expected the handle.');
      const x = handleBox.x + handleBox.width / 2;
      const y = handleBox.y + handleBox.height / 2;

      // Only `dragstart` matters here: it is where the image is handed over.
      // The drop point is irrelevant, so no target is measured.
      await mlv.page.mouse.move(x, y);
      await mlv.page.mouse.down();
      await mlv.page.mouse.move(x + 3, y + 3, { steps: 3 });
      await mlv.page.mouse.move(x, y + 40, { steps: 4 });
      await expect(mlv.page.locator('.mlv-editor__drag-ghost')).toHaveCount(1);
      const image = await mlv.page.evaluate(
        () => (window as ProbeWindow).__mlvDragImage,
      );
      await mlv.page.mouse.up();

      if (!image) throw new Error('Expected a setDragImage call.');
      // The wrapper carries the editor zoom as CSS `zoom`, which its layout
      // width leaves out; this case is only worth anything where the two
      // widths differ.
      expect(image.right - image.left).toBeGreaterThan(image.offsetWidth * 1.2);
      expect(image.y).toBe(0);
      // The offset is resolved against the image as painted, so the inline
      // start edge — the right one under `dir="rtl"` — is the rendered one.
      expect(image.left + image.x).toBeCloseTo(
        direction === 'rtl' ? image.right : image.left,
        0,
      );
    });
  });
}
