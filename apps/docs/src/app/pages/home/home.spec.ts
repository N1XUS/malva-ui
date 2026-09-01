import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import { MlvThemeService } from '@malva-ui/core/layout';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { HomePageComponent } from './home';

describe('HomePageComponent', () => {
  let fixture: ComponentFixture<HomePageComponent>;
  const currentTheme = signal<'light' | 'dark'>('light');

  beforeEach(async () => {
    currentTheme.set('light');
    await TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [
        provideRouter([]),
        provideMlvI18n(() => import('@malva-ui/i18n/en')),
        provideMlvI18nTesting(),
        {
          provide: MlvBreakpointService,
          useValue: (() => {
            // One stable instance, mirroring the real service's contract.
            const isDown = signal(false);
            return { isDown: () => isDown };
          })(),
        },
        {
          provide: MlvThemeService,
          useValue: {
            currentTheme,
            themeMode: signal<'auto' | 'light' | 'dark'>('light'),
            setTheme: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePageComponent);
    fixture.detectChanges();
  });

  it('renders every non-button, non-card homepage content anchor with the Malva link primitive', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        'main a:not([mlvButton]):not(.home-marquee__chip):not(.home-reel__card), footer a:not([mlvButton])',
      ),
    ) as HTMLAnchorElement[];

    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.classList.contains('mlv-link'))).toBe(
      true,
    );
  });

  it('renders the design principles as Malva card surfaces', () => {
    const cards = fixture.nativeElement.querySelectorAll(
      '.malva-home__principles > mlv-card',
    );

    expect(cards).toHaveLength(3);
  });

  it('uses real router links for the embedded workspace navigation', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.malva-home__application-sidebar .mlv-sidebar-item__label a[href]',
      ),
    ) as HTMLAnchorElement[];

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/page',
      '/card',
      '/timeline',
      '/density',
    ]);
  });

  it('composes the workspace canvas from the native page chrome components', () => {
    const canvas = fixture.nativeElement.querySelector(
      '.malva-home__page-canvas',
    );

    expect(canvas?.querySelector('mlv-page-header')).toBeTruthy();
    expect(canvas?.querySelector('mlv-page-content')).toBeTruthy();
    expect(
      canvas?.querySelectorAll('mlv-page-header mlv-page-summary-item'),
    ).toHaveLength(3);
  });

  it('renders the component marquee with an accessible track and a decorative ghost track', () => {
    const rows = fixture.nativeElement.querySelectorAll('.home-marquee__row');

    expect(rows).toHaveLength(2);
    for (const row of Array.from(rows) as HTMLElement[]) {
      const [real, ghost] = Array.from(
        row.querySelectorAll('.home-marquee__track'),
      );
      expect(real?.querySelectorAll('a[href]').length).toBeGreaterThan(0);
      expect(ghost?.getAttribute('aria-hidden')).toBe('true');
      expect(ghost?.querySelectorAll('a').length).toBe(0);
    }
  });

  it('renders the key-numbers strip with final figures when motion is unavailable', () => {
    const values = Array.from(
      fixture.nativeElement.querySelectorAll('docs-home-stats dd'),
    ).map((dd) => (dd as HTMLElement).textContent?.trim());

    expect(values).toEqual(['80+', '14', '6', '100%']);
  });

  it('renders the shared app bar before its main landmark', () => {
    const appBar = fixture.nativeElement.querySelector('docs-app-bar');
    const main = fixture.nativeElement.querySelector('main');

    expect(appBar).toBeTruthy();
    expect(appBar?.compareDocumentPosition(main)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps the homepage as the sole main landmark', () => {
    expect(fixture.nativeElement.querySelectorAll('main')).toHaveLength(1);
  });

  it('keeps the shared app bar as the homepage’s only semantic header', () => {
    expect(fixture.nativeElement.querySelectorAll('header')).toHaveLength(1);
  });

  it('uses the theme-matched generated illustration for the hero visual', () => {
    const image = fixture.nativeElement.querySelector(
      '.malva-home__hero-visual img',
    ) as HTMLImageElement | null;

    expect(image?.getAttribute('src')).toBe('/malva-ui-hero-glass-light.webp');

    currentTheme.set('dark');
    fixture.detectChanges();
    expect(image?.getAttribute('src')).toBe('/malva-ui-hero-glass-dark.webp');
  });

  it('keeps a static screen-reader word next to the decorative rotating headline', () => {
    const slot = fixture.nativeElement.querySelector(
      '.malva-home__word-slot',
    ) as HTMLElement | null;
    const srWord = fixture.nativeElement.querySelector(
      '.malva-home__headline-line .cdk-visually-hidden',
    ) as HTMLElement | null;

    expect(slot?.getAttribute('aria-hidden')).toBe('true');
    expect(slot?.querySelectorAll('.malva-home__word').length).toBe(4);
    expect(srWord?.textContent?.trim()).toBe('finished.');
  });

  it('uses a decorative generated image for the CTA artwork', () => {
    const image = fixture.nativeElement.querySelector(
      '.malva-home__cta-artwork',
    ) as HTMLImageElement | null;

    expect(image?.getAttribute('src')).toBe('/malva-ui-cta-aurora.webp');
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.getAttribute('aria-hidden')).toBe('true');
  });
});
