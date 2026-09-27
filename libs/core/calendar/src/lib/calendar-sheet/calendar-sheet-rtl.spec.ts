import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { ComponentFixtureAutoDetect, TestBed } from '@angular/core/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MlvCalendarSheet } from './calendar-sheet';

@Component({
  imports: [MlvCalendarSheet],
  template: `
    <div [attr.dir]="scopedDir()">
      <mlv-calendar-sheet
        [(value)]="value"
        [windowMonths]="1"
        [yearRange]="2"
      />
    </div>
  `,
})
class RtlHost {
  readonly sheet = viewChild.required(MlvCalendarSheet);
  readonly value = signal<Date | null>(new Date(2026, 0, 15));
  readonly scopedDir = signal<string | null>(null);
}

/**
 * The sheet under a `dir="rtl"` present from the first render and inside an
 * `@if` — the shape of the pickers' popup pane and of any consumer `@if`: an
 * embedded view is constructed before its nodes are inserted, so a direction
 * read at construction would resolve against a detached host and cache the
 * document's — which a flip-after-creation spec cannot see.
 */
@Component({
  imports: [MlvCalendarSheet],
  template: `
    <div dir="rtl">
      @if (shown()) {
        <mlv-calendar-sheet
          [(value)]="value"
          [windowMonths]="1"
          [yearRange]="2"
        />
      }
    </div>
  `,
})
class StaticRtlHost {
  readonly shown = signal(true);
  readonly value = signal<Date | null>(new Date(2026, 0, 15));
}

/**
 * Narrows a query result, failing with the selector rather than a bare
 * `TypeError` when the element is not there. Kept in place of a `!` assertion,
 * which the workspace's lint config forbids.
 */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what} to be rendered`);
  }
  return value;
}

describe('MlvCalendarSheet RTL', () => {
  let fixture: ComponentFixture<RtlHost>;
  let host: RtlHost;
  let root: HTMLElement;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RtlHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: ComponentFixtureAutoDetect, useValue: true },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RtlHost);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    rtlService = TestBed.inject(MlvRtlService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    fixture.destroy();
  });

  function press(key: string): void {
    must(
      root.querySelector('.mlv-calendar-sheet__months'),
      'the month list',
    ).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  function activeDate(): string | null {
    const active = root.querySelector<HTMLElement>(
      '.mlv-calendar-sheet__day[tabindex="0"]',
    );
    return active?.closest('[data-date]')?.getAttribute('data-date') ?? null;
  }

  function stripYear(): number {
    return Number(
      root.querySelector('.mlv-scrubber__item--selected')?.textContent?.trim(),
    );
  }

  it('mirrors horizontal arrows in the day grid', async () => {
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    press('ArrowLeft');
    expect(activeDate()).toBe('2026-01-16');

    press('ArrowRight');
    expect(activeDate()).toBe('2026-01-15');
  });

  it('leaves vertical arrows unchanged in RTL', async () => {
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    press('ArrowDown');
    expect(activeDate()).toBe('2026-01-22');

    press('ArrowUp');
    expect(activeDate()).toBe('2026-01-15');
  });

  it('leaves Home and End unchanged in RTL', async () => {
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    press('Home');
    expect(activeDate()).toBe('2026-01-01');

    press('End');
    expect(activeDate()).toBe('2026-01-31');
  });

  it('keeps the weekday header and day grid in logical DOM order under RTL', async () => {
    const before = Array.from(
      root.querySelectorAll('.mlv-calendar-sheet__weekday'),
      (el) => el.textContent?.trim(),
    );
    const firstWeekBefore = Array.from(
      root.querySelectorAll<HTMLElement>(
        '.mlv-calendar-sheet__week:first-of-type [data-date]',
      ),
      (el) => el.dataset['date'],
    );

    rtlService.setDirection('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      Array.from(root.querySelectorAll('.mlv-calendar-sheet__weekday'), (el) =>
        el.textContent?.trim(),
      ),
    ).toEqual(before);
    expect(
      Array.from(
        root.querySelectorAll<HTMLElement>(
          '.mlv-calendar-sheet__week:first-of-type [data-date]',
        ),
        (el) => el.dataset['date'],
      ),
    ).toEqual(firstWeekBefore);
  });

  it('puts the year strip on the inline axis so it mirrors with the sheet', () => {
    const strip = root.querySelector('.mlv-scrubber');

    expect(strip?.classList.contains('mlv-scrubber--horizontal')).toBe(true);
  });

  it('follows a scoped [dir] on an ancestor while the document stays LTR', async () => {
    host.scopedDir.set('rtl');
    await fixture.whenStable();

    expect(rtlService.direction()).toBe('ltr');
    expect(stripYear()).toBe(2026);

    must(
      root.querySelector<HTMLElement>('.mlv-scrubber__list'),
      "the year strip's listbox",
    ).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await fixture.whenStable();

    // On the inline axis, ArrowRight means *previous* under RTL.
    expect(stripYear()).toBe(2025);
  });

  // The sheet renders inside the pickers' full-screen popup pane, which CDK
  // stamps with its trigger's `dir`, or wherever a consumer places it — either
  // way it can sit in a scoped direction. The wrapper stands in for that
  // scope: a global flip passes with the direction argument missing, so only a
  // scoped one can pin it.
  it('mirrors the day-grid arrows under a scoped [dir] while the document stays LTR', async () => {
    host.scopedDir.set('rtl');
    await fixture.whenStable();
    expect(rtlService.direction()).toBe('ltr');

    press('ArrowLeft'); // "next" on the inline axis under RTL
    expect(activeDate()).toBe('2026-01-16');

    press('ArrowRight');
    expect(activeDate()).toBe('2026-01-15');

    press('ArrowUp'); // the block axis never mirrors
    expect(activeDate()).toBe('2026-01-08');

    press('ArrowDown');
    expect(activeDate()).toBe('2026-01-15');
  });

  it('keeps the day-grid arrows unmirrored in an LTR island inside an RTL document', async () => {
    rtlService.setDirection('rtl');
    host.scopedDir.set('ltr');
    await fixture.whenStable();

    press('ArrowLeft');
    expect(activeDate()).toBe('2026-01-14');

    press('ArrowRight');
    expect(activeDate()).toBe('2026-01-15');

    press('ArrowUp');
    expect(activeDate()).toBe('2026-01-08');
  });
});

describe('MlvCalendarSheet under a static [dir] ancestor', () => {
  let fixture: ComponentFixture<StaticRtlHost>;
  let root: HTMLElement;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaticRtlHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: ComponentFixtureAutoDetect, useValue: true },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaticRtlHost);
    root = fixture.nativeElement as HTMLElement;
    rtlService = TestBed.inject(MlvRtlService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    fixture.destroy();
  });

  function press(key: string): void {
    must(
      root.querySelector('.mlv-calendar-sheet__months'),
      'the month list',
    ).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  function activeDate(): string | null {
    const active = root.querySelector<HTMLElement>(
      '.mlv-calendar-sheet__day[tabindex="0"]',
    );
    return active?.closest('[data-date]')?.getAttribute('data-date') ?? null;
  }

  it('mirrors the day-grid arrows, keeping the block axis', () => {
    expect(rtlService.direction()).toBe('ltr');

    press('ArrowLeft');
    expect(activeDate()).toBe('2026-01-16');

    press('ArrowUp');
    expect(activeDate()).toBe('2026-01-09');
  });
});
