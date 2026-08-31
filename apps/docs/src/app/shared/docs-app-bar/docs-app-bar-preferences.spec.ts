import { ApplicationInitStatus } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import { MlvRtlService } from '@malva-ui/cdk/utils';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { DocsAppBarPreferencesComponent } from './docs-app-bar-preferences';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('DocsAppBarPreferencesComponent', () => {
  let component: DocsAppBarPreferencesComponent;
  let fixture: ComponentFixture<DocsAppBarPreferencesComponent>;
  let i18nService: MlvI18nService;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }),
    });
    document.documentElement.lang = 'en';

    await TestBed.configureTestingModule({
      imports: [DocsAppBarPreferencesComponent],
      providers: [
        provideAnimationsAsync('noop'),
        provideMlvDensity('comfortable'),
        provideMlvI18n(() => import('@malva-ui/i18n/en')),
      ],
    }).compileComponents();
    await TestBed.inject(ApplicationInitStatus).donePromise;

    fixture = TestBed.createComponent(DocsAppBarPreferencesComponent);
    component = fixture.componentInstance;
    i18nService = TestBed.inject(MlvI18nService);
    rtlService = TestBed.inject(MlvRtlService);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('uses one cog opener instead of inline and mobile preference controls', () => {
    const opener = fixture.nativeElement.querySelector(
      'button[aria-label="Display preferences"]',
    );
    expect(opener).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('mlv-select')).toHaveLength(
      0,
    );
  });

  it('exposes all preference controls from the popup', async () => {
    fixture.nativeElement
      .querySelector('button[aria-label="Display preferences"]')
      .click();
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = document.body.querySelector(
      '.docs-app-bar-preferences__preferences',
    );
    expect(overlay?.textContent).toContain('Theme');
    expect(overlay?.textContent).toContain('Density');
    expect(overlay?.textContent).toContain('Language');
    expect(overlay?.textContent).toContain('Direction');
    expect(overlay?.textContent).toContain('LTR');
    expect(component.directionOptions).toEqual(['ltr', 'rtl']);
    expect(component.directionToOption('rtl')).toEqual({
      label: 'RTL',
      value: 'rtl',
    });
    expect(
      overlay?.querySelector('.mlv-tab-group--appearance-boxed'),
    ).toBeTruthy();
    expect(overlay?.textContent).toContain('Auto');
    expect(overlay?.textContent).toContain('Light');
    expect(overlay?.textContent).toContain('Dark');
    expect(overlay?.querySelector('.fi-gb')).toBeTruthy();
  });

  it('changes document direction through the direction preference', () => {
    component['_setDirection']('rtl');

    expect(rtlService.direction()).toBe('rtl');
    expect(document.documentElement.dir).toBe('rtl');

    component['_setDirection']('ltr');
    expect(rtlService.direction()).toBe('ltr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('rolls back the locale and document language when loading fails', async () => {
    vi.spyOn(i18nService, 'switchLanguage').mockRejectedValue(
      new Error('chunk failed'),
    );

    await component['_switchLanguage']('de');
    fixture.detectChanges();

    expect(component.locale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(component.localeLoadError()).toBe(
      'Unable to load Deutsch. Try again.',
    );
  });

  it('switches to a newly shipped locale and updates document language', async () => {
    await component['_switchLanguage']('zh-Hans');

    expect(component.locale()).toBe('zh-Hans');
    expect(document.documentElement.lang).toBe('zh-Hans');
    expect(i18nService.select('dialog')().closeDialog).toBe('关闭对话框');
  });

  it('does not let a stale failure roll back a newer locale', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    vi.spyOn(i18nService, 'switchLanguage')
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const firstSwitch = component['_switchLanguage']('de');
    const secondSwitch = component['_switchLanguage']('fr');

    second.resolve();
    await secondSwitch;
    first.reject(new Error('stale chunk failed'));
    await firstSwitch;

    expect(component.locale()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(component.localeLoadError()).toBe('');
  });
});
