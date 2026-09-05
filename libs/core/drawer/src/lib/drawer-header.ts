import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  afterEveryRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  MLV_DENSITY_CONTEXT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { mlvNextId } from '@malva-ui/cdk/utils';
import { MlvButtonClose } from '@malva-ui/core/button';
import { MLV_DRAWER_I18N } from '@malva-ui/i18n';

import { MlvDrawer } from './drawer/drawer';
import { MlvDrawerRef } from './drawer-ref';

/** Heading level of the title `mlv-drawer-header` renders from its `title` input. */
export type MlvDrawerTitleLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** @internal Coerces `level="4"` (attribute) and `[level]="4"` alike; anything out of range falls back to 2. */
function coerceTitleLevel(
  value: MlvDrawerTitleLevel | `${MlvDrawerTitleLevel}`,
): MlvDrawerTitleLevel {
  const level = Number(value);
  return level >= 1 && level <= 6 ? (level as MlvDrawerTitleLevel) : 2;
}

/**
 * @internal The drawer a header belongs to — the declarative `MlvDrawer` host
 * or the `MlvDrawerRef` of a service-opened one. Both expose the same closing
 * and labelling surface.
 */
interface DrawerHeaderTarget {
  close(): void;
  _labelBy(id: string): void;
  _unlabelBy(id: string): void;
}

/**
 * Header row of a drawer: the title, any projected controls and the close
 * button.
 *
 * Use it as an element (`<mlv-drawer-header title="…" />`) or as an attribute
 * on a container (`<div mlvDrawerHeader>`). Never put it on a heading —
 * project the heading instead:
 * `<mlv-drawer-header><h3>Edit user</h3></mlv-drawer-header>`.
 *
 * Reading order is fixed: title → projected content → close. Projected
 * content is where `mlv-drawer-sections`, an `mlv-spacer` and action buttons
 * go; the close is always the inline-end endcap, rendered from
 * `mlv-button-close` and labelled by `MLV_DRAWER_I18N.closeDrawer`.
 *
 * Title precedence: `title` input → a projected heading (`h1`–`h6`, or any
 * element carrying a `mlvDrawerTitle` attribute). The `title` input renders
 * an `<h2>` unless `level` says otherwise — pass `level="4"` when the body
 * holds `[mlvDrawerSection]`s, whose headings are `<h5>`, so the outline
 * skips no level. The title element gets `id="mlv-drawer-title-<n>"` and is
 * registered as the drawer's `aria-labelledby` while it has text, so the
 * visible title is the accessible name unless the drawer sets
 * `ariaLabelledBy` / `ariaLabel` itself. A header without any title
 * registers nothing.
 *
 * The header projects `compact` density to its content so projected
 * `mlvButton`s and the section navigator sit on the same 36px row as the
 * close button, which is pinned at its default (`comfortable`) density —
 * `mlv-button-close` is one density step below `mlvButton` at every level,
 * so the two only align when they are not on the same setting. Override the
 * projected density with `mlvDensity` on the header.
 */
@Component({
  // Attribute form intentionally enhances the consumer's own header container.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'mlv-drawer-header, [mlvDrawerHeader]',
  imports: [MlvButtonClose],
  template: `
    @if (title(); as text) {
      @switch (level()) {
        @case (1) {
          <h1 #titleEl class="mlv-drawer__title" [id]="_titleId">{{ text }}</h1>
        }
        @case (3) {
          <h3 #titleEl class="mlv-drawer__title" [id]="_titleId">{{ text }}</h3>
        }
        @case (4) {
          <h4 #titleEl class="mlv-drawer__title" [id]="_titleId">{{ text }}</h4>
        }
        @case (5) {
          <h5 #titleEl class="mlv-drawer__title" [id]="_titleId">{{ text }}</h5>
        }
        @case (6) {
          <h6 #titleEl class="mlv-drawer__title" [id]="_titleId">{{ text }}</h6>
        }
        @default {
          <h2 #titleEl class="mlv-drawer__title" [id]="_titleId">{{ text }}</h2>
        }
      }
    } @else {
      <div #titleEl class="mlv-drawer__title" [id]="_titleId">
        <ng-content select="h1, h2, h3, h4, h5, h6, [mlvDrawerTitle]" />
      </div>
    }
    <ng-content />
    @if (_closable()) {
      <!-- The wrapper hosts a real <button>, so the bubbled native click already
           covers pointer, Enter and Space. -->
      <mlv-button-close
        class="mlv-drawer__close"
        mlvDensity="comfortable"
        shape="circle"
        variant="transparent"
        [ariaLabel]="_i18n().closeDrawer"
        (click)="_close()"
      />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  providers: [
    {
      provide: MLV_DENSITY_CONTEXT,
      useFactory: () => {
        const density = inject(MlvDensityDirective);
        // Pinned rather than inherited: the row is designed around 36px
        // controls, so an app-wide `spacious` must not grow it back to 44px.
        return computed(() => density.mlvDensity() ?? 'compact');
      },
    },
  ],
  host: {
    class: 'mlv-drawer__header',
    // `<mlv-drawer-header title="…">` feeds the input but also leaves a native
    // `title` attribute behind; bindings apply after static attributes, so this
    // strips it and the header row gets no browser tooltip.
    '[attr.title]': 'null',
  },
})
export class MlvDrawerHeader {
  /** Plain-text title rendered as a heading (see `level`). Wins over a projected heading. */
  readonly title = input<string>();

  /**
   * Heading level of the element the `title` input renders. Defaults to `2`,
   * a dialog title under the page's `<h1>`; use `4` above `[mlvDrawerSection]`
   * headings (`<h5>`) so the document outline skips no level. Ignored for a
   * projected heading, which brings its own level.
   */
  readonly level = input<
    MlvDrawerTitleLevel,
    MlvDrawerTitleLevel | `${MlvDrawerTitleLevel}`
  >(2, { transform: coerceTitleLevel });

  /**
   * Whether the close button is rendered. Defaults to `true`; the button is
   * also omitted when the header is rendered outside a drawer, where there is
   * nothing to close.
   */
  readonly closable = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** @protected i18n strings — `closeDrawer` labels the X. */
  protected readonly _i18n = inject(MLV_DRAWER_I18N);
  /**
   * @protected Id of the title element, registered as the drawer's label. Per
   * instance, so two headers in one drawer never collide on one id.
   */
  protected readonly _titleId = mlvNextId('mlv-drawer-title');

  /** @private The declarative drawer reachable from this header's declaration site, if any. */
  private readonly _drawer = inject(MlvDrawer, { optional: true });
  /** @private The ref of a service-opened drawer in this header's injector chain, if any. */
  private readonly _ref = inject(MlvDrawerRef, { optional: true });
  /** @private Host element — the DOM decides which of two in-scope drawers owns the header. */
  private readonly _hostEl = inject(ElementRef<HTMLElement>).nativeElement;
  /** @private Cache for {@link _owner}, filled the first time it resolves to a drawer. */
  private _resolvedOwner: DrawerHeaderTarget | null = null;

  /** @protected Resolved close-button visibility. */
  protected readonly _closable = computed(
    () => this.closable() && (this._drawer ?? this._ref) !== null,
  );

  /**
   * @protected The rendered title element — the heading for the `title`
   * input, the projection wrapper otherwise. Its text content decides whether
   * the drawer is labelled by this header.
   */
  protected readonly _titleEl = viewChild<ElementRef<HTMLElement>>('titleEl');

  /** @private Whether {@link _titleId} is currently registered as the drawer's label. */
  private _labelled = false;
  /** @private Set on destroy so a queued render callback never runs on a torn-down view. */
  private _destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._destroyed = true;
      if (this._labelled) {
        this._labelled = false;
        this._owner?._unlabelBy(this._titleId);
      }
    });
    // The title is only observable from the DOM (input or projected content)
    // and can change at any time, so the decision is re-taken after every
    // render rather than latched on the first one.
    afterEveryRender(() => this._syncLabel());
  }

  /**
   * @private The drawer this header labels and closes. Null when the header is
   * rendered on its own, in which case it is a plain styled row.
   *
   * Both kinds can be in scope at once: a service-opened drawer whose
   * `config.injector` sits inside a declarative `<mlv-drawer>` (a routable
   * drawer opened from a drawer body) also resolves that outer `MlvDrawer`,
   * and a declarative drawer nested in a service-opened component also
   * resolves its `MlvDrawerRef`. Injector distance cannot tell the two apart,
   * so the DOM does: the ref owns the header only while its pane contains it.
   * Resolved lazily — the portal appends the host element to the pane after
   * construction — and cached so `_unlabelBy` reaches the same target as
   * `_labelBy` did.
   */
  private get _owner(): DrawerHeaderTarget | null {
    if (this._resolvedOwner) {
      return this._resolvedOwner;
    }
    const drawer = this._drawer;
    const ref = this._ref;
    const owner =
      drawer && ref
        ? ref._paneElement?.contains(this._hostEl)
          ? ref
          : drawer
        : (drawer ?? ref);
    this._resolvedOwner = owner;
    return owner;
  }

  /**
   * @private Keeps the drawer's label in sync with the rendered title: the id
   * is registered as soon as the title element has text and removed again
   * when it loses it, so an asynchronous title still names the drawer. An
   * empty title element would leave the dialog surface with an empty
   * accessible name (an axe `aria-dialog-name` violation), so a header
   * without any title registers nothing.
   */
  private _syncLabel(): void {
    if (this._destroyed) {
      return;
    }
    const owner = this._owner;
    if (!owner) {
      return;
    }
    const hasText = !!this._titleEl()?.nativeElement.textContent?.trim();
    if (hasText === this._labelled) {
      return;
    }
    this._labelled = hasText;
    if (hasText) {
      owner._labelBy(this._titleId);
    } else {
      owner._unlabelBy(this._titleId);
    }
  }

  /** @protected Closes the drawer, as the X always does. */
  protected _close(): void {
    this._owner?.close();
  }
}
