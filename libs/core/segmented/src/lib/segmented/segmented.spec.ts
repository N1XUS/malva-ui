import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { Routes } from '@angular/router';
import {
  NavigationEnd,
  provideRouter,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { MlvSegmented } from './segmented';
import { MlvSegmentedItem } from '../segmented-item/segmented-item';
import { MlvRtlService } from '@malva-ui/cdk/utils';

@Component({
  imports: [MlvSegmented, MlvSegmentedItem],
  template: `
    <mlv-segmented
      [(value)]="value"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [tone]="tone()"
      [orientation]="orientation()"
      [equalWidth]="equalWidth()"
      ariaLabel="Period"
    >
      <button mlvSegmentedItem value="day">Day</button>
      <button mlvSegmentedItem value="week" [disabled]="weekDisabled()">
        Week
      </button>
      <button mlvSegmentedItem value="month" [active]="monthActive()">
        Month
      </button>
    </mlv-segmented>
  `,
})
class RadioHost {
  readonly value = signal<unknown>('day');
  readonly monthActive = signal<boolean | undefined>(undefined);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly weekDisabled = signal(false);
  readonly tone = signal<'neutral' | 'accent' | 'danger'>('neutral');
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
  readonly equalWidth = signal(false);
}

describe('MlvSegmented (radio mode)', () => {
  let fixture: ComponentFixture<RadioHost>;
  let host: RadioHost;
  let rtlService: MlvRtlService;

  const track = (): HTMLElement =>
    fixture.nativeElement.querySelector('.mlv-segmented__track');
  const items = (): HTMLButtonElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('button[mlvSegmentedItem]'),
    );

  function keydown(key: string): void {
    track().dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  function mockRect(
    el: HTMLElement,
    rect: { left: number; top: number; width: number; height: number },
  ): void {
    Object.defineProperty(el, 'offsetLeft', {
      configurable: true,
      get: () => rect.left,
    });
    Object.defineProperty(el, 'offsetTop', {
      configurable: true,
      get: () => rect.top,
    });
    Object.defineProperty(el, 'offsetWidth', {
      configurable: true,
      get: () => rect.width,
    });
    Object.defineProperty(el, 'offsetHeight', {
      configurable: true,
      get: () => rect.height,
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadioHost],
    }).compileComponents();
    fixture = TestBed.createComponent(RadioHost);
    host = fixture.componentInstance;
    rtlService = TestBed.inject(MlvRtlService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => rtlService?.setDirection('ltr'));

  it('has no axe violations (radio mode, incl. disabled item and disabled group)', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    host.weekDisabled.set(true);
    fixture.detectChanges();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    host.disabled.set(true);
    fixture.detectChanges();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  }, 20_000);

  it('exposes radiogroup / radio semantics', () => {
    expect(track().getAttribute('role')).toBe('radiogroup');
    expect(track().getAttribute('aria-label')).toBe('Period');
    expect(track().getAttribute('aria-orientation')).toBe('horizontal');
    expect(items().map((b) => b.getAttribute('role'))).toEqual([
      'radio',
      'radio',
      'radio',
    ]);
    expect(items().map((b) => b.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(items().map((b) => b.getAttribute('type'))).toEqual([
      'button',
      'button',
      'button',
    ]);
  });

  it('marks the item matching the value as active', () => {
    expect(items()[0].classList.contains('mlv-segmented-item--active')).toBe(
      true,
    );
    host.value.set('month');
    fixture.detectChanges();
    expect(items()[0].classList.contains('mlv-segmented-item--active')).toBe(
      false,
    );
    expect(items()[2].classList.contains('mlv-segmented-item--active')).toBe(
      true,
    );
    expect(items()[2].getAttribute('aria-checked')).toBe('true');
  });

  it('lets [active] override the derived state', () => {
    // `value` is still 'day', so the override makes two items active — which
    // is exactly the shape the dev warning below flags. Silence it here.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      host.monthActive.set(true);
      fixture.detectChanges();
      expect(items()[2].classList.contains('mlv-segmented-item--active')).toBe(
        true,
      );
      expect(items()[2].getAttribute('aria-checked')).toBe('true');
      host.monthActive.set(false);
      host.value.set('month');
      fixture.detectChanges();
      expect(items()[2].classList.contains('mlv-segmented-item--active')).toBe(
        false,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('warns once when [active] leaves two items active in radio mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      host.monthActive.set(true);
      fixture.detectChanges();
      expect(items()[0].getAttribute('aria-checked')).toBe('true');
      expect(items()[2].getAttribute('aria-checked')).toBe('true');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('mlv-segmented');
      // Still once after further churn — the flag is per group instance.
      host.value.set('week');
      fixture.detectChanges();
      host.value.set('day');
      fixture.detectChanges();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn while a single item is active', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      host.value.set('week');
      fixture.detectChanges();
      host.value.set('month');
      fixture.detectChanges();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('selects on click and updates the two-way value', () => {
    items()[1].click();
    fixture.detectChanges();
    expect(host.value()).toBe('week');
    expect(items()[1].getAttribute('aria-checked')).toBe('true');
  });

  it('applies a roving tabindex: only the selected item is tabbable', () => {
    expect(items().map((b) => b.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
    ]);
    host.value.set('week');
    fixture.detectChanges();
    expect(items().map((b) => b.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ]);
  });

  it('falls back to the first enabled item as tab stop when nothing is selected', () => {
    host.value.set(undefined);
    fixture.detectChanges();
    expect(items().map((b) => b.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
    ]);
  });

  it('reflects a disabled item as native disabled and skips it on click', () => {
    host.weekDisabled.set(true);
    fixture.detectChanges();
    expect(items()[1].hasAttribute('disabled')).toBe(true);
    expect(items()[1].classList.contains('mlv-segmented-item--disabled')).toBe(
      true,
    );
    items()[1].click();
    fixture.detectChanges();
    expect(host.value()).toBe('day');
  });

  it('disables every item when the group is disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();
    expect(items().every((b) => b.hasAttribute('disabled'))).toBe(true);
    expect(track().getAttribute('aria-disabled')).toBe('true');
    expect(
      fixture.nativeElement.querySelector('.mlv-segmented--disabled'),
    ).not.toBeNull();
  });

  it('blocks selection while readonly', () => {
    host.readonly.set(true);
    fixture.detectChanges();
    items()[2].click();
    fixture.detectChanges();
    expect(host.value()).toBe('day');
    expect(
      fixture.nativeElement.querySelector('.mlv-segmented--readonly'),
    ).not.toBeNull();
  });

  it('reflects tone / orientation / equal-width as host modifiers', () => {
    const el: HTMLElement =
      fixture.nativeElement.querySelector('mlv-segmented');
    expect(el.classList.contains('mlv-segmented--tone-neutral')).toBe(true);
    expect(el.classList.contains('mlv-segmented--horizontal')).toBe(true);
    host.tone.set('danger');
    host.orientation.set('vertical');
    host.equalWidth.set(true);
    fixture.detectChanges();
    expect(el.classList.contains('mlv-segmented--tone-danger')).toBe(true);
    expect(el.classList.contains('mlv-segmented--vertical')).toBe(true);
    expect(el.classList.contains('mlv-segmented--equal-width')).toBe(true);
    expect(track().getAttribute('aria-orientation')).toBe('vertical');
  });

  it('positions the indicator over the active item and flags the group as measured', async () => {
    mockRect(items()[1], { left: 60, top: 3, width: 48, height: 30 });
    host.value.set('week');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const style = track().style;
    expect(style.getPropertyValue('--mlv-segmented-indicator-left')).toBe(
      '60px',
    );
    expect(style.getPropertyValue('--mlv-segmented-indicator-top')).toBe('3px');
    expect(style.getPropertyValue('--mlv-segmented-indicator-width')).toBe(
      '48px',
    );
    expect(style.getPropertyValue('--mlv-segmented-indicator-height')).toBe(
      '30px',
    );
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.mlv-segmented--measured'),
    ).not.toBeNull();
  });

  it('stays unmeasured while the active item has no box (hidden container)', async () => {
    // No mocked rect: jsdom reports every offset as 0, standing in for a group
    // first rendered inside a display:none container / collapsed panel.
    host.value.set('week');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.mlv-segmented--measured'),
    ).toBeNull();
  });

  it('re-measures the pill when the direction flips', async () => {
    mockRect(items()[1], { left: 60, top: 3, width: 48, height: 30 });
    host.value.set('week');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      track().style.getPropertyValue('--mlv-segmented-indicator-left'),
    ).toBe('60px');

    // Mirroring the group moves every item without changing its size, so no
    // ResizeObserver fires — the direction itself has to drive the re-measure.
    mockRect(items()[1], { left: 12, top: 3, width: 48, height: 30 });
    TestBed.inject(MlvRtlService).setDirection('rtl');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      track().style.getPropertyValue('--mlv-segmented-indicator-left'),
    ).toBe('12px');
  });

  it('collapses the indicator when no item is active', async () => {
    host.value.set(undefined);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      track().style.getPropertyValue('--mlv-segmented-indicator-width'),
    ).toBe('0px');
    expect(
      track().style.getPropertyValue('--mlv-segmented-indicator-height'),
    ).toBe('0px');
  });

  it('ArrowRight / ArrowDown select and focus the next enabled item, wrapping', () => {
    items()[0].focus();
    keydown('ArrowRight');
    expect(host.value()).toBe('week');
    expect(document.activeElement).toBe(items()[1]);
    keydown('ArrowDown');
    expect(host.value()).toBe('month');
    keydown('ArrowRight');
    expect(host.value()).toBe('day');
  });

  it('ArrowLeft / ArrowUp select the previous item, Home / End jump', () => {
    items()[0].focus();
    keydown('ArrowLeft');
    expect(host.value()).toBe('month');
    keydown('ArrowUp');
    expect(host.value()).toBe('week');
    keydown('Home');
    expect(host.value()).toBe('day');
    keydown('End');
    expect(host.value()).toBe('month');
  });

  it('mirrors only horizontal arrow navigation in RTL', () => {
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    items()[0].focus();

    keydown('ArrowLeft');
    expect(host.value()).toBe('week');

    keydown('ArrowUp');
    expect(host.value()).toBe('day');
  });

  it('skips disabled items during arrow navigation', () => {
    host.weekDisabled.set(true);
    fixture.detectChanges();
    items()[0].focus();
    keydown('ArrowRight');
    expect(host.value()).toBe('month');
    expect(document.activeElement).toBe(items()[2]);
  });

  it('prevents default on handled keys only', () => {
    items()[0].focus();
    const arrow = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    track().dispatchEvent(arrow);
    expect(arrow.defaultPrevented).toBe(true);
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    track().dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('moves focus but not selection while readonly', () => {
    host.readonly.set(true);
    fixture.detectChanges();
    items()[0].focus();
    keydown('ArrowRight');
    expect(host.value()).toBe('day');
    expect(document.activeElement).toBe(items()[1]);
  });
});

@Component({ template: '' })
class BlankPage {}

const ROUTES: Routes = [
  { path: 'inbox', component: BlankPage },
  { path: 'inbox/archive', component: BlankPage },
  { path: 'sent', component: BlankPage },
];

@Component({
  imports: [MlvSegmented, MlvSegmentedItem, RouterLink, RouterLinkActive],
  template: `
    <mlv-segmented>
      <a
        mlvSegmentedItem
        routerLink="/inbox"
        [linkActiveOptions]="{ exact: exact() }"
        >Inbox</a
      >
      <a mlvSegmentedItem routerLink="/sent" [disabled]="sentDisabled()"
        >Sent</a
      >
      <a
        mlvSegmentedItem
        routerLink="/inbox/archive"
        routerLinkActive="is-active"
        >Archive</a
      >
    </mlv-segmented>
  `,
})
class LinkHost {
  readonly exact = signal(false);
  readonly sentDisabled = signal(false);
}

describe('MlvSegmented (link mode)', () => {
  let fixture: ComponentFixture<LinkHost>;
  let host: LinkHost;
  let router: Router;

  const track = (): HTMLElement =>
    fixture.nativeElement.querySelector('.mlv-segmented__track');
  const links = (): HTMLAnchorElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('a[mlvSegmentedItem]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinkHost],
      providers: [provideRouter(ROUTES)],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LinkHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function navigate(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('has no axe violations (link mode, incl. active and disabled links)', async () => {
    await navigate('/sent');
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    host.sentDisabled.set(true);
    fixture.detectChanges();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  }, 20_000);

  it('renders no radiogroup semantics and keeps links in the natural tab order', () => {
    expect(track().hasAttribute('role')).toBe(false);
    expect(track().hasAttribute('aria-label')).toBe(false);
    expect(links().every((a) => !a.hasAttribute('role'))).toBe(true);
    expect(links().every((a) => !a.hasAttribute('tabindex'))).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.mlv-segmented--link'),
    ).not.toBeNull();
  });

  it('marks the link matching the current URL active with aria-current="page"', async () => {
    await navigate('/sent');
    expect(links()[1].classList.contains('mlv-segmented-item--active')).toBe(
      true,
    );
    expect(links()[1].getAttribute('aria-current')).toBe('page');
    expect(links()[0].hasAttribute('aria-current')).toBe(false);
  });

  it('matches by subset by default and exactly with linkActiveOptions.exact', async () => {
    await navigate('/inbox/archive');
    expect(links()[0].classList.contains('mlv-segmented-item--active')).toBe(
      true,
    );
    host.exact.set(true);
    await navigate('/inbox');
    await navigate('/inbox/archive');
    expect(links()[0].classList.contains('mlv-segmented-item--active')).toBe(
      false,
    );
  });

  it('honours a routerLinkActive present on the host', async () => {
    await navigate('/inbox/archive');
    expect(links()[2].classList.contains('is-active')).toBe(true);
    expect(links()[2].getAttribute('aria-current')).toBe('page');
    await navigate('/sent');
    expect(links()[2].hasAttribute('aria-current')).toBe(false);
  });

  it('takes a disabled link out of the tab order and prevents its click', async () => {
    await navigate('/inbox');
    host.sentDisabled.set(true);
    fixture.detectChanges();
    expect(links()[1].getAttribute('aria-disabled')).toBe('true');
    expect(links()[1].getAttribute('tabindex')).toBe('-1');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    links()[1].dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it('stops the router from navigating when a disabled link is clicked', async () => {
    await navigate('/inbox');
    host.sentDisabled.set(true);
    fixture.detectChanges();
    const navigated: string[] = [];
    const sub = router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) navigated.push(e.urlAfterRedirects);
    });
    links()[1].dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    sub.unsubscribe();
    expect(navigated).toEqual([]);
    expect(router.url).toBe('/inbox');
    expect(links()[1].classList.contains('mlv-segmented-item--active')).toBe(
      false,
    );
  });

  it('still lets an enabled link navigate on click', async () => {
    await navigate('/inbox');
    links()[1].dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/sent');
    expect(links()[1].classList.contains('mlv-segmented-item--active')).toBe(
      true,
    );
  });

  it('leaves the keyboard model inert — arrows neither move focus nor are handled', () => {
    links()[0].focus();
    const arrow = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    track().dispatchEvent(arrow);
    fixture.detectChanges();
    expect(document.activeElement).toBe(links()[0]);
    expect(arrow.defaultPrevented).toBe(false);
  });
});

@Component({
  imports: [MlvSegmented, MlvSegmentedItem, RouterLink],
  template: `
    <mlv-segmented>
      <a mlvSegmentedItem routerLink="/inbox">Inbox</a>
      <button mlvSegmentedItem value="a">A</button>
      <button mlvSegmentedItem value="b">B</button>
    </mlv-segmented>
  `,
})
class MixedHost {}

describe('MlvSegmented (mixed hosts)', () => {
  it('warns once when a group mixes <a> and <button> items', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await TestBed.configureTestingModule({
        imports: [MixedHost],
        providers: [provideRouter([])],
      }).compileComponents();
      const fixture = TestBed.createComponent(MixedHost);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('mlv-segmented');
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn for a group of plain buttons', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await TestBed.configureTestingModule({
        imports: [RadioHost],
      }).compileComponents();
      const fixture = TestBed.createComponent(RadioHost);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('MlvSegmented stylesheet', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const group = readFileSync(join(dir, 'segmented.scss'), 'utf8');
  const item = readFileSync(
    join(dir, '../segmented-item/segmented-item.scss'),
    'utf8',
  );

  it('declares the consumer-facing custom properties with their defaults', () => {
    expect(group).toContain('--mlv-segmented-radius: var(--mlv-radius-button)');
    expect(group).toContain('--mlv-segmented-track-padding: 0.1875rem');
    expect(group).toContain(
      '--mlv-segmented-track-bg: var(--mlv-background-sunken)',
    );
    expect(group).toContain(
      '--mlv-segmented-separator-color: var(--mlv-border-normal)',
    );
    expect(group).toContain(
      '--mlv-segmented-indicator-duration: var(--mlv-duration-normal)',
    );
    // Neutral pill defaults live on the block too, so a consumer replacing the
    // host `[class]` (and with it the `--tone-*` modifier) never gets a
    // transparent pill. Owner override 2026-08-25: the raised, non-accent
    // pill (boxed-tabs look), not the `selected` token pair AB-R8 briefly
    // converged it on.
    expect(group).toContain(
      '--mlv-segmented-pill-bg: var(--mlv-background-raised)',
    );
    expect(group).toContain(
      '--mlv-segmented-active-color: var(--mlv-text-primary)',
    );
  });

  // NB: these assert against the SCSS *source* (not compiled CSS), so they look
  // for the `$tones` map keys and `&`-nested selectors as written below.
  it('maps every tone to a pale background', () => {
    for (const tone of ['accent', 'info', 'success', 'warning', 'danger']) {
      expect(group).toContain(`'${tone}': (`);
      expect(group).toContain(`--mlv-background-${tone}-1-pale`);
    }
    expect(group).toContain('&--tone-#{$name}');
  });

  it('gates the slide transition behind --measured and ships a reduced-motion path', () => {
    expect(group).toContain('&--measured > &__track > &__indicator');
    expect(group).toContain("mixins.reduced-motion('mlv-segmented')");
  });

  it('lifts the track in the dark theme', () => {
    expect(group).toContain("[mlvTheme='dark'] .#{$block}");
    expect(group).toContain(
      '--mlv-segmented-track-bg: var(--mlv-background-neutral-1)',
    );
  });

  it('lifts the neutral pill one step above the dark track (owner override 2026-08-25)', () => {
    // AB-R8/SF-R1 briefly converged the neutral pill on
    // `--mlv-background-selected`, which needed no per-component dark
    // override. The owner asked for the previous raised-pill treatment back;
    // `--mlv-background-raised` (#1e1e1e) is darker than the dark track
    // (`--mlv-background-neutral-1` = #262626), so the neutral-700 override
    // is restored to keep the pill lifted rather than sunken.
    expect(group).toContain("[mlvTheme='dark'] .#{$block}--tone-neutral");
    expect(group).toContain(
      '--mlv-segmented-pill-bg: var(--mlv-palette-neutral-700)',
    );
  });

  it('never uses a --mlv-padding-* pair as a single length', () => {
    expect(group).not.toMatch(/--mlv-padding-/);
    expect(item).not.toMatch(/--mlv-padding-/);
  });

  it('draws separators only between adjacent items and hides them around the active one', () => {
    expect(item).toContain('& + &');
    expect(item).toContain('&--active + &::before');
    expect(item).toContain('&:hover + &::before');
    expect(item).toContain('&:active + &::before');
    expect(item).toContain('& + &--active::before');
  });

  it('gives an idle segment hover and pressed feedback', () => {
    expect(item).toContain('background: var(--mlv-background-neutral-1-hover)');
    expect(item).toContain(
      'background: var(--mlv-background-neutral-1-active)',
    );
    expect(item).toContain('&:active:not(&--active):not(&--disabled)');
  });
});

// ---------------------------------------------------------------------------
// Scoped direction (#147)
//
// Direction is scoped: a `dir` attribute on any ancestor flips that subtree
// while the document stays LTR — and CDK stamps `dir` on every overlay host, so
// a segmented group rendered in a popup, menu or dialog is such a subtree by
// construction. Both direction-aware halves of this component — the pill
// measurement and the arrow-key model — resolve against the host, so they can
// never disagree about which direction applies.
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvSegmented, MlvSegmentedItem],
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-segmented [(value)]="value" ariaLabel="Period">
        <button mlvSegmentedItem value="day">Day</button>
        <button mlvSegmentedItem value="week">Week</button>
        <button mlvSegmentedItem value="month">Month</button>
      </mlv-segmented>
    </div>
  `,
})
class ScopedDirHost {
  readonly value = signal<unknown>('day');
  readonly scopeDir = signal<'rtl' | 'ltr'>('rtl');
}

describe('MlvSegmented scoped direction', () => {
  let fixture: ComponentFixture<ScopedDirHost>;
  let host: ScopedDirHost;
  let rtlService: MlvRtlService;

  const items = (): HTMLButtonElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('button[mlvSegmentedItem]'),
    );

  function keydown(key: string): void {
    (
      fixture.nativeElement.querySelector(
        '.mlv-segmented__track',
      ) as HTMLElement
    ).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopedDirHost],
    }).compileComponents();
    fixture = TestBed.createComponent(ScopedDirHost);
    host = fixture.componentInstance;
    rtlService = TestBed.inject(MlvRtlService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    rtlService?.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  it('mirrors the horizontal arrows inside a [dir="rtl"] subtree while the document stays LTR', () => {
    expect(rtlService.direction()).toBe('ltr');

    items()[0].focus();
    keydown('ArrowLeft');
    expect(host.value()).toBe('week'); // ArrowLeft is "next" once mirrored
    keydown('ArrowRight');
    expect(host.value()).toBe('day');
  });

  it('leaves the vertical arrows and Home/End alone inside a [dir="rtl"] subtree', () => {
    expect(rtlService.direction()).toBe('ltr');

    items()[0].focus();
    keydown('ArrowDown');
    expect(host.value()).toBe('week'); // vertical never mirrors
    keydown('ArrowUp');
    expect(host.value()).toBe('day');
    keydown('End');
    expect(host.value()).toBe('month');
    keydown('Home');
    expect(host.value()).toBe('day');
  });

  it('keeps a [dir="ltr"] island unmirrored while the document is RTL', async () => {
    host.scopeDir.set('ltr');
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtlService.direction()).toBe('rtl');

    items()[0].focus();
    keydown('ArrowRight');
    expect(host.value()).toBe('week'); // the island reads LTR
    keydown('ArrowLeft');
    expect(host.value()).toBe('day');
  });
});
