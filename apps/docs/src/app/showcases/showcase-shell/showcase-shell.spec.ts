import { ApplicationInitStatus } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideRouter,
  RouteConfigLoadEnd,
  RouteConfigLoadStart,
} from '@angular/router';
import { Subject } from 'rxjs';
import { provideMlvDensity } from '@malva-ui/cdk/density';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import {
  ShowcaseShellComponent,
  SHOWCASE_ROUTER_EVENTS,
} from './showcase-shell';

describe('ShowcaseShellComponent', () => {
  let fixture: ComponentFixture<ShowcaseShellComponent>;
  const routerEvents = new Subject<RouteConfigLoadStart | RouteConfigLoadEnd>();

  beforeEach(async () => {
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
      imports: [ShowcaseShellComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync('noop'),
        provideMlvDensity('comfortable'),
        provideMlvI18n(() => import('@malva-ui/i18n/en')),
        { provide: SHOWCASE_ROUTER_EVENTS, useValue: routerEvents },
      ],
    }).compileComponents();
    await TestBed.inject(ApplicationInitStatus).donePromise;

    fixture = TestBed.createComponent(ShowcaseShellComponent);
    fixture.detectChanges();
  });

  it('renders a busy skeleton while a lazy child route loads and keeps one app bar', () => {
    const route = { path: 'data-operations' };
    routerEvents.next(new RouteConfigLoadStart(route));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('main[aria-busy="true"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelectorAll(
        '.showcase-loading__grid mlv-skeleton',
      ),
    ).toHaveLength(4);
    expect(fixture.nativeElement.querySelectorAll('docs-app-bar')).toHaveLength(
      1,
    );
    expect(fixture.nativeElement.querySelectorAll('header')).toHaveLength(1);

    routerEvents.next(new RouteConfigLoadEnd(route));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('main[aria-busy="true"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('docs-app-bar')).toHaveLength(
      1,
    );
  });
});
