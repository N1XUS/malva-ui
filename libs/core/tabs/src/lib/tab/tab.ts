import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  DestroyRef,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { RouterLink } from '@angular/router';
import type { IsActiveMatchOptions, UrlTree } from '@angular/router';
import { MlvTabDef } from '../tab-def';
import { MlvTabContentDef } from '../tab-content-def';
import { MlvTabsService } from '../tabs.service';

@Component({
  selector: 'mlv-tab',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: 'display: none',
  },
})
export class MlvTab implements OnInit {
  /** @private Scoped tabs service the tab registers/unregisters itself with. */
  private readonly _tabsService = inject(MlvTabsService);

  /** @private DestroyRef used to unregister the tab on destroy. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private Native `RouterLink` directive applied to this `<mlv-tab>` when the
   * consumer sets `[routerLink]` (optional/self — `null` for non-routed tabs).
   *
   * The `routerLink` sits on the `display:none` `<mlv-tab>` def node purely as a
   * URL *carrier*: the header tab is rendered separately by `mlv-tab-group`, so
   * `routerLinkActive` cannot style it and active state is derived explicitly
   * from `Router.isActive` (see `MlvTabGroup` routed-mode notes). This is
   * intentional, not a workaround to be removed later.
   */
  private readonly _routerLink = inject(RouterLink, {
    optional: true,
    self: true,
  });

  readonly value = input.required<string>();

  /** When `true`, prevents the tab from being activated. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Match options controlling when this routed tab is treated as active, mirroring
   * `RouterLinkActive.routerLinkActiveOptions`. Accepts the `{ exact: boolean }`
   * shorthand or a full `IsActiveMatchOptions`. Defaults to `{ exact: false }`
   * (subset match). Only consulted when a `[routerLink]` is present.
   */
  readonly linkActiveOptions = input<{ exact: boolean } | IsActiveMatchOptions>(
    {
      exact: false,
    },
  );

  readonly defTemplate = contentChild(MlvTabDef);
  readonly contentTemplate = contentChild(MlvTabContentDef);

  /**
   * The `UrlTree` this tab links to, or `null` when no `[routerLink]` is applied.
   * A non-null value on any tab switches the parent `mlv-tab-group` into routed
   * mode, where the active tab is derived from the current URL.
   */
  urlTree(): UrlTree | null {
    return this._routerLink?.urlTree ?? null;
  }

  ngOnInit(): void {
    this._tabsService.register(this);
    this._destroyRef.onDestroy(() => this._tabsService.unregister(this));
  }
}
