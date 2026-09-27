import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  Component,
  DOCUMENT,
  signal,
  type WritableSignal,
} from '@angular/core';
import { By } from '@angular/platform-browser';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvPopup, POPUP_DETACH_WATCHDOG_MS } from '@malva-ui/core/popup';
import { MlvDayPicker } from './day-picker';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

@Component({
  template: `<mlv-day-picker />`,
  imports: [MlvDayPicker],
})
class TestHostComponent {}

describe('MlvDayPicker', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const el = fixture.nativeElement.querySelector('mlv-day-picker');
    expect(el).toBeTruthy();
  });

  it('opts the calendar popup into auto mobile fullscreen mode', () => {
    fixture.detectChanges();
    const popup = fixture.debugElement.query(By.directive(MlvPopup))
      .componentInstance as MlvPopup;
    expect(popup.mobileMode()).toBe('auto');
  });
});

// ---------------------------------------------------------------------------
// Stylesheet — compiled once; assertions read declarations by selector.
// ---------------------------------------------------------------------------

// `sass` is a Node-only dependency; loading it through `createRequire` keeps
// it out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

/**
 * Declarations of every emitted rule whose selector list contains exactly
 * `selector`, joined. Sass splits a block around a nested rule and emits
 * shared declarations under one comma-separated selector list, so one
 * selector can own several blocks and share others.
 */
function cssRule(css: string, selector: string): string {
  const bodies: string[] = [];
  for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = head
      .trim()
      .split(/,\s*/)
      .map((candidate) => candidate.trim());
    if (selectors.includes(selector)) bodies.push(body);
  }
  expect(bodies.length, `rule "${selector}" is emitted`).toBeGreaterThan(0);
  return bodies.join('\n');
}

describe('MlvDayPicker stylesheet', () => {
  const css = stripCssLayersFromText(
    sass.compile(
      resolve(dirname(fileURLToPath(import.meta.url)), 'day-picker.scss'),
    ).css,
  );

  // A control with no value shows its `placeholder` as a rendered span where
  // an input shows it through `::placeholder`. Both are placeholder text and
  // read the same token — `--mlv-text-tertiary`, the placeholder/disabled step
  // of the text ramp that mlv-input, mlv-textarea and mlv-number-input use —
  // so a form that mixes the controls shows one placeholder grey, not two.
  it('paints the placeholder with the shared placeholder token', () => {
    expect(cssRule(css, '.mlv-day-picker__placeholder')).toContain(
      'color: var(--mlv-text-tertiary)',
    );
  });

  // -------------------------------------------------------------------------
  // Mobile full-screen sheet geometry (#130)
  //
  // jsdom implements no layout and resolves no percentage, so the fill lives in
  // the compiled stylesheet as far as a spec can see. Every percentage in this
  // ancestor chain is inert: `.mlv-popup__inner`'s own `min-height: 100%` never
  // resolves either, because its containing block's height is content-derived
  // (popup.scss § `--fullscreen`, measured at #116).
  // -------------------------------------------------------------------------

  const SHEET = '.mlv-day-picker__popup--sheet';

  it('claims the leftover sheet height with a length flex basis', () => {
    // `flex: 1 1 0`, never `height: 100%` and never the `flex: 1` shorthand
    // (whose basis is `0%`): both are percentages here, so both leave the
    // wrapper content-sized and the month list top-anchored with the rest of
    // the viewport blank.
    const body = cssRule(css, SHEET);
    expect(body).toMatch(/flex:\s*1\s+1\s+0(?!%)/);
    expect(body).not.toMatch(/height:\s*100%/);
  });

  it('becomes the column the sheet is laid out in', () => {
    // The anchored wrapper is a plain block; the sheet's three regions need a
    // flex column above them for the middle one to be the part that grows.
    const body = cssRule(css, SHEET);
    expect(body).toContain('display: flex');
    expect(body).toContain('flex-direction: column');
    expect(body).toContain('min-height: 0');
  });

  it('drops the dropdown inset so the month list runs edge to edge', () => {
    // `--mlv-popover-inset` is the shared *dropdown* inset, and
    // `.mlv-popup--fullscreen` already pads `__inner` for the sheet.
    expect(cssRule(css, SHEET)).toContain('padding: 0');
  });

  it('passes the basis and the floor down to the sheet body', () => {
    const body = cssRule(css, `${SHEET} .mlv-calendar-sheet`);
    expect(body).toMatch(/flex:\s*1\s+1\s+0(?!%)/);
    expect(body).toContain('min-height: 0');
  });

  it('leaves the anchored dropdown on the popover inset', () => {
    expect(cssRule(css, '.mlv-day-picker__popup')).toContain(
      'padding: var(--mlv-popover-inset)',
    );
  });
});

// ---------------------------------------------------------------------------
// MlvDayPicker — mobile full-screen sheet (#130)
// ---------------------------------------------------------------------------

/**
 * Stubs {@link MlvBreakpointService} so the sheet/dropdown switch can be driven
 * from the spec. jsdom's `matchMedia` never matches a `min-width` query, so the
 * real service is pinned to `'sm'` and `isFullscreen()` is stuck `true` — which
 * cannot prove anything about the anchored dropdown. Since #130 the two modes
 * render different templates rather than the same one styled two ways, so a
 * suite that opens the popup has to say which one it means.
 */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(false);
  }
}

describe('MlvDayPicker (mobile full-screen sheet)', () => {
  let fixture: ComponentFixture<MlvDayPicker<Date>>;
  let component: MlvDayPicker<Date>;
  let hostEl: HTMLElement;
  let breakpoint: FakeBreakpointService;

  /** The popup body, which the popup renders into a CDK overlay. */
  const popupEl = (): HTMLElement | null =>
    document.getElementById(component.popupId());

  /** `YYYY-MM-DD`, matching the adapter's `data-date` hook on a sheet cell. */
  const iso = (date: Date): string =>
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

  /** A day in a month the sheet's default window certainly renders. */
  const someDay = (offsetMonths: number, day: number): Date => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + offsetMonths, day);
  };

  const sheetDay = (date: Date): HTMLButtonElement => {
    const button = popupEl()?.querySelector<HTMLButtonElement>(
      `[data-date="${iso(date)}"] .mlv-calendar-sheet__day`,
    );
    if (!button)
      throw new Error(`sheet renders no day button for ${iso(date)}`);
    return button;
  };

  async function open(): Promise<void> {
    component.toggleDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /**
   * The sheet header's dismiss control. `mlv-button-close` puts the click
   * handler on its own host, so either the host or its inner `<button>`
   * dismisses; the inner one is what a user actually hits.
   */
  const sheetCloseButton = (): HTMLElement => {
    const host = document.querySelector<HTMLElement>('.mlv-popup__close');
    if (!host) throw new Error('the sheet header renders no close button');
    return host.querySelector('button') ?? host;
  };

  async function click(el: HTMLElement): Promise<void> {
    el.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDayPicker],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();

    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;

    fixture = TestBed.createComponent(MlvDayPicker<Date>);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    document.body.appendChild(hostEl);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    hostEl.remove();
  });

  it('renders the calendar sheet instead of the anchored calendar', async () => {
    breakpoint.down.set(true);
    await open();

    expect(popupEl()?.querySelectorAll('mlv-calendar-sheet').length).toBe(1);
    expect(popupEl()?.querySelectorAll('mlv-calendar').length).toBe(0);
  });

  it('leaves the anchored dropdown on the single-month calendar', async () => {
    breakpoint.down.set(false);
    await open();

    expect(popupEl()?.querySelectorAll('mlv-calendar-sheet').length).toBe(0);
    expect(popupEl()?.querySelectorAll('mlv-calendar').length).toBe(1);
  });

  it('still commits on tap in the anchored dropdown', async () => {
    // The desktop contract is unchanged by #130: one tap picks and closes,
    // with no confirm step. Only the sheet gained one.
    breakpoint.down.set(false);
    await open();

    const day = Array.from(
      popupEl()?.querySelectorAll<HTMLElement>('.mlv-calendar__day') ?? [],
    ).find((el) => el.textContent?.trim() === '15');
    expect(day).toBeTruthy();
    await click(day as HTMLElement);

    expect(component.value()).not.toBeNull();
    expect(component.isOpen()).toBe(false);
  });

  it('holds a sheet tap as pending until Done', async () => {
    breakpoint.down.set(true);
    await open();

    const target = someDay(1, 12);
    await click(sheetDay(target));

    // Pending only — nothing is committed and the sheet stays open.
    expect(component.value()).toBeNull();
    expect(component.isOpen()).toBe(true);

    const done = document.querySelector<HTMLButtonElement>(
      '.mlv-day-picker__done',
    );
    expect(done).toBeTruthy();
    await click(done as HTMLElement);

    expect(component.value()?.getDate()).toBe(target.getDate());
    expect(component.value()?.getMonth()).toBe(target.getMonth());
    expect(component.isOpen()).toBe(false);
  });

  it('discards the pending day when the sheet is dismissed', async () => {
    breakpoint.down.set(true);
    await open();
    await click(sheetDay(someDay(1, 12)));

    await click(sheetCloseButton());

    expect(component.value()).toBeNull();
    expect(component.isOpen()).toBe(false);
  });

  it('reopens the sheet on the committed value, not the discarded one', async () => {
    breakpoint.down.set(true);
    await open();
    await click(sheetDay(someDay(1, 12)));

    await click(sheetCloseButton());
    await open();

    expect(
      popupEl()?.querySelectorAll('.mlv-calendar-sheet__day--selected').length,
    ).toBe(0);
  });

  it('seeds the pending day when opened without going through the trigger', async () => {
    // `isOpen` is a public signal, so a consumer can open the sheet directly
    // instead of calling `toggleDropdown()`. Seeding only in the trigger would
    // leave the sheet showing no selection, and Done would then commit that
    // empty pending value over the committed date.
    const committed = someDay(0, 9);
    component.value.set(committed);
    breakpoint.down.set(true);

    component.isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      popupEl()?.querySelectorAll('.mlv-calendar-sheet__day--selected').length,
    ).toBe(1);

    const done = document.querySelector<HTMLButtonElement>(
      '.mlv-day-picker__done',
    );
    await click(done as HTMLElement);

    expect(component.value()?.getDate()).toBe(committed.getDate());
    expect(component.value()?.getMonth()).toBe(committed.getMonth());
  });

  it('marks the popup body as a sheet when the popup goes full-screen', async () => {
    // The modifier is what hands the sheet the leftover height (day-picker.scss
    // § `--sheet`); without it the month list sits at its natural size at the
    // top of the sheet with the rest of the viewport blank.
    breakpoint.down.set(true);
    await open();

    expect(popupEl()?.classList.contains('mlv-day-picker__popup--sheet')).toBe(
      true,
    );
  });

  it('leaves the anchored dropdown unmarked', async () => {
    breakpoint.down.set(false);
    await open();

    expect(popupEl()?.classList.contains('mlv-day-picker__popup--sheet')).toBe(
      false,
    );
  });

  it('discards the pending day on close, not only on the next open', async () => {
    // `toggleDropdown()` re-seeds the pending value as it opens, so a discard
    // that only happened there would look identical through that route. It is
    // not the only route: `isOpen` is a public signal a host can drive, and it
    // opens the popup without going through the seeding. Closing is therefore
    // where the discard has to happen for the sheet to reopen on the committed
    // value however it was opened.
    breakpoint.down.set(true);
    await open();
    await click(sheetDay(someDay(1, 12)));
    await click(sheetCloseButton());

    // The close button only requests the leave; `afterClosed` — and with it the
    // discard — fires when the overlay actually detaches. jsdom dispatches no
    // `animationend`, so this waits out the container's detach watchdog, the
    // way `popup.spec.ts` waits out the leave fallback.
    await new Promise((resolve) =>
      setTimeout(resolve, POPUP_DETACH_WATCHDOG_MS + 100),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    component.isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      popupEl()?.querySelectorAll('.mlv-calendar-sheet__day--selected').length,
    ).toBe(0);
  });

  it('keeps Done out of the anchored dropdown', async () => {
    breakpoint.down.set(false);
    await open();

    expect(document.querySelectorAll('.mlv-day-picker__done').length).toBe(0);
  });

  it("lands focus on the sheet's day grid, not the year strip", async () => {
    // The year strip's listbox is the first tabbable node in the sheet, so the
    // generic first-tabbable scan would leave a keyboard user on the year
    // scrubber with the calendar untouched.
    breakpoint.down.set(true);
    await open();

    (component as unknown as { _onPopupOpened(): void })._onPopupOpened();

    expect(
      document.activeElement?.classList.contains('mlv-calendar-sheet__day'),
    ).toBe(true);
  });

  it('titles the sheet with the select-day string, not the placeholder', async () => {
    // The placeholder is trigger copy ("Select date...") and reads as an empty
    // field, not as a heading; the sheet header needs a title.
    const popup = fixture.debugElement.query(By.directive(MlvPopup))
      .componentInstance as MlvPopup;

    expect(popup.mobileTitle()).toBe('Select day');
  });
});

// ---------------------------------------------------------------------------
// MlvDayPicker — injected DOCUMENT
// ---------------------------------------------------------------------------

describe('MlvDayPicker (injected DOCUMENT)', () => {
  /**
   * The popup is portaled into the CDK overlay container of the injected
   * document. `_onPopupOpened()` looked it up with the ambient
   * `document.getElementById`, which finds nothing there — under server
   * rendering, or in any document other than the global one — so focus never
   * moved into the calendar.
   */
  it('moves focus into the popup rendered in the injected document', async () => {
    const isolated = document.implementation.createHTMLDocument('day-picker');
    await TestBed.configureTestingModule({
      imports: [MlvDayPicker],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
        { provide: DOCUMENT, useValue: isolated },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvDayPicker<Date>);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.toggleDropdown();
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = isolated.getElementById(component.popupId());
    const target = panel?.querySelector<HTMLElement>(
      '[tabindex="0"], button, [tabindex]',
    );
    expect(target, 'the popup renders into the injected document').toBeTruthy();
    // jsdom moves no `activeElement` inside a `createHTMLDocument()` document,
    // so the call itself is what is observed.
    const focus = vi.spyOn(target as HTMLElement, 'focus');

    (component as unknown as { _onPopupOpened(): void })._onPopupOpened();

    expect(focus).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });
});
