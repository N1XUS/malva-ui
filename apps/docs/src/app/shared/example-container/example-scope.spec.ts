import { DOCUMENT } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvDensityService } from '@malva-ui/cdk/density';
import type { MlvDirection } from '@malva-ui/cdk/utils';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import type { MlvTheme } from '@malva-ui/core/layout';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { DocsExampleScopeDirective } from './example-scope';

@Component({
  imports: [DocsExampleScopeDirective, MlvButton],
  template: `
    <div
      class="stage"
      docsExampleScope
      [density]="density()"
      [direction]="direction()"
      [theme]="theme()"
    >
      <button class="inside" mlvButton>Inside</button>
    </div>
    <button class="outside" mlvButton>Outside</button>
  `,
})
class HostComponent {
  readonly density = signal<MlvDensity>('tight');
  readonly direction = signal<MlvDirection>('rtl');
  readonly theme = signal<MlvTheme>('dark');
}

describe('DocsExampleScopeDirective', () => {
  const createFixture = () => {
    const fixture = TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  };

  const stageOf = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector('.stage') as HTMLElement;

  it('keeps the host class while stamping the density cascade class', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    const stage = stageOf(fixture);
    expect(stage.classList.contains('stage')).toBe(true);
    expect(stage.classList.contains('mlv--tight')).toBe(true);
  });

  it('writes dir and mlvTheme on its own element only', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    const stage = stageOf(fixture);
    expect(stage.getAttribute('dir')).toBe('rtl');
    expect(stage.getAttribute('mlvTheme')).toBe('dark');

    const document = TestBed.inject(DOCUMENT);
    expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');
    expect(document.documentElement.getAttribute('mlvTheme')).not.toBe('dark');
  });

  it('projects its density to descendants without touching the global one', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    const inside = fixture.nativeElement.querySelector(
      '.inside',
    ) as HTMLElement;
    const outside = fixture.nativeElement.querySelector(
      '.outside',
    ) as HTMLElement;

    expect(inside.classList.contains('mlv-button--tight')).toBe(true);
    expect(outside.classList.contains('mlv-button--comfortable')).toBe(true);
    expect(TestBed.inject(MlvDensityService).density()).toBe('comfortable');
    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
  });

  it('re-resolves descendants when the scoped density changes', async () => {
    const fixture = createFixture();
    await fixture.whenStable();

    fixture.componentInstance.density.set('spacious');
    await fixture.whenStable();

    const stage = stageOf(fixture);
    const inside = fixture.nativeElement.querySelector(
      '.inside',
    ) as HTMLElement;

    expect(stage.classList.contains('mlv--spacious')).toBe(true);
    expect(stage.classList.contains('mlv--tight')).toBe(false);
    expect(inside.classList.contains('mlv-button--spacious')).toBe(true);
  });
});

@Component({
  imports: [
    DocsExampleScopeDirective,
    MlvButton,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
  ],
  template: `
    <div
      class="stage"
      docsExampleScope
      density="compact"
      direction="rtl"
      theme="dark"
    >
      <button class="trigger" mlvButton [mlvPopupTrigger]="popup">Open</button>
      <mlv-popup #popup ariaLabel="Scoped panel">
        <ng-template mlvPopupContent>
          <button class="in-overlay" mlvButton>Inside the overlay</button>
        </ng-template>
      </mlv-popup>
    </div>
  `,
})
class OverlayHostComponent {}

describe('DocsExampleScopeDirective and overlays', () => {
  // A CDK pane is portaled to <body>, so it inherits nothing from the stage's
  // DOM. Two of the three scoped mechanisms still reach it, by different routes
  // — this pins which, so the third stays a documented gap rather than a
  // surprise.
  //
  // The third is theme: nothing writes `mlvTheme` on a pane, so a panel opened
  // from an example flipped to dark on a light page renders light. Pre-existing
  // and library-side (the overlay owners would have to carry the trigger's
  // theme). Fixable, deferred: tracked in #240.
  it('carries the scoped direction and density into a portaled pane', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [OverlayHostComponent],
      providers: [provideMlvI18nTesting()],
    }).createComponent(OverlayHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('.trigger') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const document = TestBed.inject(DOCUMENT);
    const container = document.querySelector(
      '.cdk-overlay-container',
    ) as HTMLElement;

    // Direction: `MlvPopupService` resolves it from the trigger, which sits
    // inside the stage, and CDK stamps it on the pane host.
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();

    // Density: the panel is a `TemplatePortal` declared inside the stage, so
    // its embedded view keeps the declaration injector and resolves the
    // scoped `MLV_DENSITY_CONTEXT`.
    const inOverlay = container.querySelector('.in-overlay') as HTMLElement;
    expect(inOverlay.classList.contains('mlv-button--compact')).toBe(true);
  });
});
