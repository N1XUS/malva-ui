import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { MlvSwitch } from '@malva-ui/core/switch';
import type {
  MlvEditorToolbarAppearance,
  MlvEditorToolbarPosition,
} from '@malva-ui/editor';
import { MlvEditor } from '@malva-ui/editor';

/** Max-height presets: auto-grow, a number (px) and a string length. */
type LayoutMaxHeight = 'auto' | '240' | '24rem';

/** One short line per paragraph, so the layout effects are easy to follow. */
const LAYOUT_DOCUMENT = [
  '<h2>Release notes</h2>',
  ...Array.from(
    { length: 24 },
    (_, index) =>
      `<p>Change ${index + 1}: one short line of release notes.</p>`,
  ),
].join('');

@Component({
  selector: 'docs-editor-layout-example',
  imports: [MlvEditor, MlvSegmented, MlvSegmentedItem, MlvSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorLayoutExample {
  readonly value = signal<string | null>(LAYOUT_DOCUMENT);
  readonly position = signal<MlvEditorToolbarPosition>('top');
  readonly appearance = signal<MlvEditorToolbarAppearance>('bar');
  readonly sticky = signal(false);
  readonly maxHeightChoice = signal<LayoutMaxHeight>('auto');

  /** `undefined` grows with the content; `240` is px; `'24rem'` passes through. */
  readonly maxHeight = computed<number | string | undefined>(() => {
    switch (this.maxHeightChoice()) {
      case '240':
        return 240;
      case '24rem':
        return '24rem';
      default:
        return undefined;
    }
  });

  /**
   * Why the Sticky switch has no effect right now, or `null` when it applies.
   * `toolbarSticky` only pins an uncapped bar: a capped editor scrolls inside
   * its own viewport, which the bar sits outside, and the floating bubble
   * follows the selection instead.
   */
  readonly stickyHint = computed<string | null>(() => {
    if (this.appearance() === 'floating') {
      return 'The floating bubble follows the selection instead.';
    }
    if (this.maxHeight() !== undefined) {
      return 'No effect under a height cap.';
    }
    return null;
  });

  /**
   * Clears the docs' fixed app bar, the same 5.5rem the docs' own
   * `scroll-padding-top` reserves. A bottom toolbar pins flush to the page's
   * bottom edge.
   */
  readonly stickyOffset = computed(() =>
    this.position() === 'top' ? '5.5rem' : '0px',
  );
}
