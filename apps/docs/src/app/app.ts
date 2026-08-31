import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { DocsAppBarComponent } from './shared';
import { ShowcaseLoadingContentComponent } from './showcases/showcase-loading/showcase-loading-content';

@Component({
  selector: 'docs-root',
  imports: [DocsAppBarComponent, RouterOutlet, ShowcaseLoadingContentComponent],
  template: `
    <router-outlet />
    @if (initialShowcaseLoading()) {
      <div class="app__showcase-loading-frame">
        <docs-app-bar />
        <docs-showcase-loading-content />
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly _router = inject(Router);

  /** Whether the first application navigation is still lazily resolving a showcase route. */
  readonly initialShowcaseLoading = signal(false);

  constructor() {
    this._router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        const path = event.url.split(/[?#]/, 1)[0];
        if (
          !this._router.navigated &&
          (path === '/showcases' || path.startsWith('/showcases/'))
        ) {
          this.initialShowcaseLoading.set(true);
        }
      }

      if (
        this.initialShowcaseLoading() &&
        (event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError)
      ) {
        this.initialShowcaseLoading.set(false);
      }
    });
  }
}
