import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  MlvTabGroup,
  MlvTab,
  MlvTabDef,
  MlvTabContentDef,
} from '@malva-ui/core/tabs';

@Component({
  selector: 'docs-tabs-boxed-routable-example',
  imports: [RouterLink, MlvTabGroup, MlvTab, MlvTabDef, MlvTabContentDef],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TabsBoxedRoutableExampleComponent {
  /**
   * Sensible default shown before any `?demoTab=` query param is present. Once a
   * tab is activated the URL (via `routerLink`) becomes the source of truth and
   * `activeTab` is derived from `Router.isActive`.
   */
  readonly activeTab = signal('overview');
}
