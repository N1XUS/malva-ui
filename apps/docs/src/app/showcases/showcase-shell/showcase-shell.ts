import {
  ChangeDetectionStrategy,
  Component,
  inject,
  InjectionToken,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  RouteConfigLoadEnd,
  RouteConfigLoadStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import type { Event as RouterEvent } from '@angular/router';
import type { Observable } from 'rxjs';
import { DocsAppBarComponent } from '../../shared';
import { ShowcaseLoadingContentComponent } from '../showcase-loading/showcase-loading-content';

/** Router event stream used by the shell to track lazy child route loading. */
export const SHOWCASE_ROUTER_EVENTS = new InjectionToken<
  Observable<RouterEvent>
>('SHOWCASE_ROUTER_EVENTS', { factory: () => inject(Router).events });

@Component({
  selector: 'docs-showcase-shell',
  imports: [DocsAppBarComponent, RouterOutlet, ShowcaseLoadingContentComponent],
  templateUrl: './showcase-shell.html',
  styleUrl: './showcase-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseShellComponent {
  private readonly _routerEvents = inject(SHOWCASE_ROUTER_EVENTS);

  /** Whether a child showcase route is currently being lazy loaded. */
  readonly routeLoading = signal(false);

  constructor() {
    this._routerEvents.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof RouteConfigLoadStart) this.routeLoading.set(true);
      if (event instanceof RouteConfigLoadEnd) this.routeLoading.set(false);
    });
  }
}
