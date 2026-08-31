import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  Injector,
} from '@angular/core';
import { MlvAbstractToastContainerComponent } from '../abstract-toast-container';
import type { MlvInternalToast } from '../toast.types';
import { MLV_TOAST_CLOSE } from '../toast.types';
import { MlvToastItem } from '../toast-item/toast-item';
import { NgComponentOutlet } from '@angular/common';

/**
 * Extra clearance kept between a top-anchored stack and the top viewport edge,
 * on top of the panel's own padding. Consumers set
 * `--mlv-toast-inset-block-start` on any scope the overlay inherits from —
 * `document.documentElement` is the reliable one, since the CDK overlay
 * container is a body child and never a descendant of the page.
 */
const TOAST_INSET_BLOCK_START = 'var(--mlv-toast-inset-block-start, 0px)';

/**
 * The bottom-edge counterpart of {@link TOAST_INSET_BLOCK_START}. It defaults
 * to `--mlv-page-dock-height`, which a sticky `mlv-page-dock` publishes on
 * `document.documentElement` while it is mounted — so bottom toasts clear a
 * page's Save/Discard dock out of the box, with no wiring by the consumer.
 */
const TOAST_INSET_BLOCK_END =
  'var(--mlv-toast-inset-block-end, var(--mlv-page-dock-height, 0px))';

@Component({
  selector: 'mlv-toast-container',
  imports: [NgComponentOutlet],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-toast-container',
    '[class.is-bottom]': '!position().startsWith("top")',
    '[style.--mlv-toast-position]': 'position().startsWith("top") ? -1 : 1',
    '[style.--mlv-toast-panel-inset-block-start]': '_insetBlockStart()',
    '[style.--mlv-toast-panel-inset-block-end]': '_insetBlockEnd()',
  },
})
export class MlvToastContainer<
  T extends MlvInternalToast = MlvInternalToast,
> extends MlvAbstractToastContainerComponent<T> {
  /**
   * @protected Clearance applied above a top-anchored stack. `null` for bottom
   * positions, where the anchored edge is the opposite one.
   */
  protected readonly _insetBlockStart = computed(() =>
    this.position().startsWith('top') ? TOAST_INSET_BLOCK_START : null,
  );

  /**
   * @protected Clearance applied below a bottom-anchored stack, keeping it
   * clear of a sticky page dock. `null` for top positions.
   */
  protected readonly _insetBlockEnd = computed(() =>
    this.position().startsWith('top') ? null : TOAST_INSET_BLOCK_END,
  );

  /** @private Parent injector used as the root for each toast item's injector. */
  private readonly _injector = inject(Injector);

  /** @protected Per-item injector providing the `MLV_TOAST_CLOSE` callback to each rendered toast. */
  protected readonly itemInjector = Injector.create({
    providers: [
      {
        provide: MLV_TOAST_CLOSE,
        useValue: (id: string) => this.requestClose(id),
      },
    ],
    parent: this._injector,
  });

  override component = MlvToastItem;
}
