import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MlvDensityService } from '@malva-ui/cdk/density';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { ExampleControlsComponent } from './example-controls';

describe('ExampleControlsComponent', () => {
  const createFixture = () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ExampleControlsComponent],
      providers: [provideRouter([]), provideMlvI18nTesting()],
    }).createComponent(ExampleControlsComponent);
    fixture.detectChanges();
    return fixture;
  };

  const segmentOf = (
    fixture: { nativeElement: HTMLElement },
    switcher: string,
    value: string,
  ) =>
    fixture.nativeElement.querySelector(
      `[data-switcher="${switcher}"] [value="${value}"]`,
    ) as HTMLButtonElement;

  it('puts the switchers on a tight action bar', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    const bar = fixture.nativeElement.querySelector(
      '.mlv-action-bar',
    ) as HTMLElement;

    expect(bar).not.toBeNull();
    expect(bar.getAttribute('mlvDensity')).toBe('tight');
    // The bar is a density scope, so the switchers inside resolve tight too.
    expect(bar.classList.contains('mlv-action-bar--tight')).toBe(true);
    expect(
      fixture.nativeElement
        .querySelector('[data-switcher="density"]')
        ?.classList.contains('mlv-segmented--tight'),
    ).toBe(true);
  });

  it('opts the bar out of the entrance animation', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    const bar = fixture.nativeElement.querySelector(
      '.mlv-action-bar',
    ) as HTMLElement;

    // Every `docs-example-container` on a page is created inside `doc-page`'s
    // `@for`, so every control bar *enters the DOM* on every navigation. Left
    // animated, arriving at `/data-table` fades and slides 23 chrome bars at
    // once — this bar is furniture, not a surface that just appeared.
    expect(bar.classList.contains('mlv-action-bar--no-animation')).toBe(true);
  });

  it('names every switcher group', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    for (const switcher of ['density', 'direction', 'theme', 'viewport']) {
      const group = fixture.nativeElement.querySelector(
        `[data-switcher="${switcher}"] [role="radiogroup"]`,
      ) as HTMLElement;
      expect(group?.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('emits the picked values without touching the document', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    segmentOf(fixture, 'direction', 'rtl').click();
    segmentOf(fixture, 'theme', 'dark').click();
    segmentOf(fixture, 'density', 'spacious').click();
    segmentOf(fixture, 'viewport', 'mobile').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.direction()).toBe('rtl');
    expect(fixture.componentInstance.theme()).toBe('dark');
    expect(fixture.componentInstance.density()).toBe('spacious');
    expect(fixture.componentInstance.viewport()).toBe('mobile');

    // Per-example, never global: the page keeps its own three settings.
    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
    expect(TestBed.inject(MlvDensityService).density()).toBe('comfortable');

    const document = TestBed.inject(DOCUMENT);
    expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');
    expect(document.documentElement.getAttribute('mlvTheme')).not.toBe('dark');
  });

  it('reaches for none of the three document-owning services', () => {
    // Resolved from this spec's own location, not `process.cwd()`: the target
    // runs from the workspace root, so a cwd-relative path misses the file.
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'example-controls.ts'),
      'utf8',
    );

    for (const service of [
      'MlvDensityService',
      'MlvRtlService',
      'MlvThemeService',
    ]) {
      expect(source).not.toContain(`inject(${service}`);
    }
  });

  it('reflects the selection on the radio segments', async () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('direction', 'rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      segmentOf(fixture, 'direction', 'rtl').getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      segmentOf(fixture, 'direction', 'ltr').getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('has no axe violations', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
