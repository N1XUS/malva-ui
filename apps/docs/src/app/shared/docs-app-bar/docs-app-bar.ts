import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  MlvActionBar,
  MlvActionBarLogo,
  MlvActionBarSpacer,
} from '@malva-ui/core/action-bar';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDensityDirective } from '@malva-ui/cdk/density';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { filter, map } from 'rxjs';
import { DocsAppBarPreferencesComponent } from './docs-app-bar-preferences';

@Component({
  selector: 'docs-app-bar',
  imports: [
    NgOptimizedImage,
    RouterLink,
    MlvActionBar,
    MlvActionBarLogo,
    MlvActionBarSpacer,
    MlvButton,
    MlvDensityDirective,
    MlvSegmented,
    MlvSegmentedItem,
    DocsAppBarPreferencesComponent,
  ],
  templateUrl: './docs-app-bar.html',
  styleUrl: './docs-app-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsAppBarComponent {
  private readonly _router = inject(Router);
  private readonly _url = toSignal(
    this._router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this._router.url),
    ),
    { initialValue: this._router.url },
  );

  readonly showcasesActive = computed(() => {
    const path = this._url().split(/[?#]/, 1)[0];
    return path === '/showcases' || path.startsWith('/showcases/');
  });

  readonly docsActive = computed(() => !this.showcasesActive());
}
