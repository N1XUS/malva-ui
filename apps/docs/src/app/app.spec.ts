import {
  ApplicationInitStatus,
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { provideMlvDensity } from '@malva-ui/cdk/density';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import { App } from './app';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

@Component({
  selector: 'docs-deferred-showcase',
  template: '<main id="main-content"><h1>Deferred showcase</h1></main>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DeferredShowcaseComponent {}

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let lazyShowcase: Deferred<typeof DeferredShowcaseComponent>;
  let router: Router;

  beforeEach(async () => {
    lazyShowcase = deferred<typeof DeferredShowcaseComponent>();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          {
            path: 'showcases',
            loadComponent: () => lazyShowcase.promise,
          },
        ]),
        provideAnimationsAsync('noop'),
        provideMlvDensity('comfortable'),
        provideMlvI18n(() => import('@malva-ui/i18n/en')),
      ],
    }).compileComponents();
    await TestBed.inject(ApplicationInitStatus).donePromise;

    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    router = TestBed.inject(Router);
  });

  it('keeps the showcase app bar and busy skeleton visible during direct lazy navigation', async () => {
    const navigation = router.navigateByUrl('/showcases');
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('docs-app-bar')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('main[aria-busy="true"]'),
    ).toBeTruthy();

    lazyShowcase.resolve(DeferredShowcaseComponent);
    await navigation;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('main[aria-busy="true"]'),
    ).toBeNull();
  });
});
