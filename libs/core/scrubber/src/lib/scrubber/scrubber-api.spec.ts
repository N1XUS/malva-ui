import { Component, signal, viewChild } from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MlvScrubber } from './scrubber';

/**
 * Specs for the two things the extraction had to generalise away from the time
 * picker: the **item type** (with a display hook in place of the hardcoded
 * zero-padded two-digit numeral) and the **orientation** (the original was
 * vertical in four hardcoded places).
 */

interface Month {
  readonly id: number;
  readonly name: string;
}

const MONTHS: readonly Month[] = [
  { id: 1, name: 'January' },
  { id: 2, name: 'February' },
  { id: 3, name: 'March' },
];

@Component({
  imports: [MlvScrubber],
  template: `
    <mlv-scrubber
      label="Hours"
      [items]="items()"
      [selectedValue]="selected()"
      [orientation]="orientation()"
      [displayWith]="format()"
    />
  `,
})
class NumberHost {
  readonly scrubber = viewChild.required(MlvScrubber);
  readonly items = signal<number[]>([0, 1, 2, 3, 2078]);
  readonly selected = signal(0);
  readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
  readonly format = signal<(value: number) => string>((value) => String(value));
}

@Component({
  imports: [MlvScrubber],
  template: `
    <mlv-scrubber
      label="Month"
      [items]="items()"
      [selectedValue]="selected()"
      [displayWith]="format"
    />
  `,
})
class MonthHost {
  readonly items = signal<readonly Month[]>(MONTHS);
  readonly selected = signal<Month>(MONTHS[0]);
  readonly format = (month: Month): string => month.name;
}

function optionText(fixture: ComponentFixture<unknown>): string[] {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '[role="option"]',
    ),
  ).map((el) => el.textContent?.trim() ?? '');
}

function listbox(fixture: ComponentFixture<unknown>): HTMLElement {
  return (fixture.nativeElement as HTMLElement).querySelector(
    '[role="listbox"]',
  ) as HTMLElement;
}

describe('MlvScrubber — item type and display hook', () => {
  let fixture: ComponentFixture<NumberHost>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
    });
    fixture = TestBed.createComponent(NumberHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders the raw value by default — no zero padding of its own', async () => {
    // The two-digit zero padding was the *time picker's* format, baked into the
    // primitive. A year strip wants `2078`, not `78`.
    expect(optionText(fixture)).toEqual(['0', '1', '2', '3', '2078']);
  });

  it('renders through displayWith when one is supplied', async () => {
    fixture.componentInstance.format.set((value) =>
      String(value).padStart(2, '0'),
    );
    await fixture.whenStable();

    expect(optionText(fixture)).toEqual(['00', '01', '02', '03', '2078']);
  });

  it('feeds displayWith to the aria option label, not only the text node', async () => {
    // aria's type-ahead matches `searchTerm().toLowerCase().startsWith(query)`,
    // and `searchTerm` is `ngOption`'s `[label]`. A formatter that only reached
    // the text node would leave type-ahead searching the raw value — so this
    // asserts the format through aria's own behaviour rather than through an
    // attribute (`ngOption` emits no `aria-label`).
    fixture.componentInstance.format.set(
      (value) =>
        ['zero', 'one', 'two', 'three', 'year'][value] ?? String(value),
    );
    await fixture.whenStable();

    const list = listbox(fixture);
    list.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'o', bubbles: true }),
    );
    await fixture.whenStable();

    const active = list.getAttribute('aria-activedescendant');
    const options = Array.from(
      list.querySelectorAll<HTMLElement>('[role="option"]'),
    );
    expect(options.findIndex((el) => el.id === active)).toBe(1);
  });

  it('accepts a non-primitive item type', async () => {
    const monthFixture = TestBed.createComponent(MonthHost);
    monthFixture.detectChanges();
    await monthFixture.whenStable();

    expect(optionText(monthFixture)).toEqual(['January', 'February', 'March']);
    monthFixture.destroy();
  });
});

describe('MlvScrubber — orientation', () => {
  let fixture: ComponentFixture<NumberHost>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
    });
    fixture = TestBed.createComponent(NumberHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('is a vertical listbox by default', () => {
    expect(listbox(fixture).getAttribute('aria-orientation')).toBe('vertical');
    const host = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-scrubber',
    ) as HTMLElement;
    expect(host.className).toContain('mlv-scrubber--vertical');
  });

  it('tells aria when it is horizontal, so ArrowLeft/Right navigate', async () => {
    fixture.componentInstance.orientation.set('horizontal');
    await fixture.whenStable();

    expect(listbox(fixture).getAttribute('aria-orientation')).toBe(
      'horizontal',
    );
    const host = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-scrubber',
    ) as HTMLElement;
    expect(host.className).toContain('mlv-scrubber--horizontal');
    expect(host.className).not.toContain('mlv-scrubber--vertical');
  });
});
