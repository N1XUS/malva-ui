import type { ComponentRef, Type } from '@angular/core';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvDrawerSectionsService } from '../drawer-sections.service';
import { MlvDrawerResize } from '../drawer-resize';
import type { MlvDrawerPosition } from '../drawer.service';
import {
  DRAWER_HIDDEN_TRANSFORMS,
  resolveDrawerPanelDimensions,
} from './drawer-geometry';

/**
 * The drawer panel: the one `role="dialog"` surface every drawer renders in,
 * whichever way it was opened.
 *
 * `<mlv-drawer>` renders it in its overlay template and projects the
 * consumer's `mlvDrawerContent` into it; `MlvDrawerService` (and so every
 * routable drawer) attaches it to the CDK pane and creates the opened
 * component inside it through {@link _attachContent}. Three things exist only
 * because this component is constructed, which is why a service-opened drawer
 * used to get none of them:
 *
 * - **`drawer.scss`.** Angular injects a component stylesheet with the first
 *   instance and removes it with the last, so the panel, header, body,
 *   footer, handle and backdrop rules arrive with the panel itself instead of
 *   depending on some `<mlv-drawer>` being alive elsewhere on the page.
 * - **The resize handle** (`resizable`, `snapPoints`, `defaultSnap`).
 * - **`MlvDrawerSectionsService`**, which `[mlvDrawerSection]` and
 *   `mlv-drawer-sections` inject. Content created through
 *   {@link _attachContent} resolves this instance; declarative content
 *   resolves by its declaration site and keeps getting `MlvDrawer`'s.
 *
 * The owner binds the rest: the enter / leave classes and the guarded
 * `animationend` (`MlvDrawer`'s template, `MlvOverlayServiceBase` /
 * `MlvOverlayRef` on the service path), the accessible name and the focus
 * trap.
 *
 * @internal Not exported from the entry point.
 */
@Component({
  // The panel is a plain `<div>` on both paths, as the declarative template
  // always rendered it; an attribute selector keeps that element name for a
  // dynamically created host too.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'div[mlvDrawerPanel]',
  imports: [MlvDrawerResize],
  template: `
    @if (resizable()) {
      <div
        class="mlv-drawer__handle"
        mlvDrawerResize
        [position]="position()"
        [snapPoints]="snapPoints()"
        (dismissed)="dismissed.emit()"
      >
        <span class="mlv-drawer__handle-pill" aria-hidden="true"></span>
      </div>
    }
    <ng-content />
    <ng-container #content />
  `,
  styleUrl: './drawer.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MlvDrawerSectionsService],
  host: {
    class: 'mlv-drawer',
    role: 'dialog',
    'aria-modal': 'true',
    '[class]': '"mlv-drawer--" + position()',
    '[class.mlv-drawer--resizable]': 'resizable()',
    '[style.width]': '_dimensions()["width"]',
    '[style.height]': '_dimensions()["height"]',
    '[style.min-width]': '_dimensions()["minWidth"]',
    '[style.min-height]': '_dimensions()["minHeight"]',
    '[style.max-width]': '_dimensions()["maxWidth"]',
    '[style.max-height]': '_dimensions()["maxHeight"]',
    '[style.--mlv-drawer-hidden-transform]': '_hiddenTransform()',
  },
})
export class MlvDrawerPanel {
  /** Edge of the viewport the drawer slides from. */
  readonly position = input<MlvDrawerPosition>('right');

  /** Sizing-axis size of a panel that is not `resizable`. */
  readonly size = input('300px');

  /** Renders the drag handle and sizes the panel from `defaultSnap`. */
  readonly resizable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Viewport-percentage snap points handed to the drag handle. */
  readonly snapPoints = input<number[]>([]);

  /** Initial viewport percentage of a `resizable` panel. */
  readonly defaultSnap = input<number>(100);

  /** Floor on the sizing axis, clamped to the viewport. */
  readonly minSize = input('0px');

  /** Ceiling on the sizing axis, clamped to the viewport. */
  readonly maxSize = input('100%');

  /** Emits when the drag handle asks to dismiss the drawer. */
  readonly dismissed = output<void>();

  /** @protected Inline geometry bound onto the host. */
  protected readonly _dimensions = computed(() =>
    resolveDrawerPanelDimensions({
      position: this.position(),
      size: this.size(),
      resizable: this.resizable(),
      defaultSnap: this.defaultSnap(),
      minSize: this.minSize(),
      maxSize: this.maxSize(),
    }),
  );

  /** @protected Off-screen transform the shared enter / leave keyframes read. */
  protected readonly _hiddenTransform = computed(
    () => DRAWER_HIDDEN_TRANSFORMS[this.position()],
  );

  /**
   * @private Anchor the service path creates the opened component at — after
   * the handle and after anything projected, so the DOM order matches the
   * declarative template's.
   */
  private readonly _contentAnchor = viewChild.required('content', {
    read: ViewContainerRef,
  });

  /** @private This panel's own view; marked when content is added from outside a render. */
  private readonly _changeDetectorRef = inject(ChangeDetectorRef);

  /**
   * @internal Creates `component` inside the panel, the way
   * `MlvDrawerService` renders the component it was asked to open.
   *
   * Synchronous, so the opened component is constructed inside `open()` as
   * it was when the service attached it to the pane directly. Its injector is
   * this panel's: `MlvDrawerSectionsService` here, then the `MlvDrawerRef` /
   * `DRAWER_DATA` injector the panel was attached with, then the caller's
   * `config.injector`. The host gets `mlv-drawer__content`, the one element
   * between the panel and a header, which the merged bottom-sheet band in
   * `drawer.scss` accounts for.
   *
   * @param component - The component to render in the drawer.
   * @returns The created component.
   */
  _attachContent<T>(component: Type<T>): ComponentRef<T> {
    const contentRef = this._contentAnchor().createComponent(component);
    (contentRef.location.nativeElement as HTMLElement).classList.add(
      'mlv-drawer__content',
    );
    // An OnPush view is skipped by the next tick unless it is marked, and the
    // view just inserted into its container would be skipped with it.
    this._changeDetectorRef.markForCheck();
    return contentRef;
  }
}
