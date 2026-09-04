import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import axe from 'axe-core';
import { MlvRadio } from './radio';
import { MlvRadioGroup } from '../radio-group/radio-group';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

@Component({
  template: `<mlv-radio [value]="'test'">Test</mlv-radio>`,
  imports: [MlvRadio],
})
class TestHostComponent {}

@Component({
  template: `
    <mlv-radio [value]="'a'" aria-label="Select row" />
    <mlv-radio [value]="'b'" aria-labelledby="ext-label" />
    <span id="ext-label">External label</span>
  `,
  imports: [MlvRadio],
})
class RadioAriaHostComponent {}

@Component({
  template: `
    <mlv-radio-group>
      <mlv-radio [value]="'first'">First</mlv-radio>
      <mlv-radio [value]="'disabled'" [disabled]="true">Disabled</mlv-radio>
      <mlv-radio [value]="'third'">Third</mlv-radio>
    </mlv-radio-group>
  `,
  imports: [MlvRadio, MlvRadioGroup],
})
class RadioGroupHostComponent {}

function dispatchArrowDown(element: HTMLElement): void {
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
  });
  Object.defineProperty(event, 'keyCode', { get: () => 40 });
  element.dispatchEvent(event);
}

describe('MlvRadio', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const el = fixture.nativeElement.querySelector('mlv-radio');
    expect(el).toBeTruthy();
  });

  it('does not emit an empty aria-label/aria-labelledby on the input when none is supplied', () => {
    fixture.detectChanges();
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-radio__native');
    expect(input?.hasAttribute('aria-label')).toBe(false);
    expect(input?.hasAttribute('aria-labelledby')).toBe(false);
  });
});

describe('MlvRadio host aria-label/aria-labelledby forwarding', () => {
  let fixture: ComponentFixture<RadioAriaHostComponent>;
  let hosts: HTMLElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadioAriaHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RadioAriaHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    hosts = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-radio'),
    );
  });

  it('moves a host aria-label onto the inner input and strips it from the host', () => {
    const host = hosts[0];
    const input = host.querySelector<HTMLInputElement>('.mlv-radio__native');
    expect(host.hasAttribute('aria-label')).toBe(false);
    expect(input?.getAttribute('aria-label')).toBe('Select row');
  });

  it('moves a host aria-labelledby onto the inner input and strips it from the host', () => {
    const host = hosts[1];
    const input = host.querySelector<HTMLInputElement>('.mlv-radio__native');
    expect(host.hasAttribute('aria-labelledby')).toBe(false);
    expect(input?.getAttribute('aria-labelledby')).toBe('ext-label');
  });

  it('has no aria-prohibited-attr violations (axe)', async () => {
    const results = await axe.run(fixture.nativeElement as HTMLElement, {
      runOnly: { type: 'rule', values: ['aria-prohibited-attr'] },
    });
    expect(results.violations).toEqual([]);
  });
});

describe('MlvRadioGroup', () => {
  it('should skip disabled radios during arrow navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [RadioGroupHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(RadioGroupHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const radios = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-radio'),
    );

    const firstInput =
      radios[0].querySelector<HTMLInputElement>('.mlv-radio__native');
    firstInput?.focus();
    firstInput?.dispatchEvent(new FocusEvent('focus'));
    dispatchArrowDown(radios[0]);
    fixture.detectChanges();

    // Focus now lands on the native radio input inside the third radio.
    expect(radios[2].contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(
      radios[2].querySelector('.mlv-radio__native'),
    );
  });

  it('single focus target: native input tabbable, host not tabbable', async () => {
    await TestBed.configureTestingModule({
      imports: [RadioGroupHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(RadioGroupHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const radios = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-radio'),
    );
    // Host is never tabbable; the native input carries the roving tabindex.
    radios.forEach((r) => expect(r.getAttribute('tabindex')).toBeNull());
    const firstInput =
      radios[0].querySelector<HTMLInputElement>('.mlv-radio__native');
    expect(firstInput?.getAttribute('tabindex')).toBe('0');
  });

  it('ArrowRight also advances selection (skipping disabled)', async () => {
    await TestBed.configureTestingModule({
      imports: [RadioGroupHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(RadioGroupHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const radios = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-radio'),
    );
    const firstInput =
      radios[0].querySelector<HTMLInputElement>('.mlv-radio__native');
    firstInput?.focus();
    firstInput?.dispatchEvent(new FocusEvent('focus'));
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    });
    radios[0].dispatchEvent(event);
    fixture.detectChanges();

    expect(document.activeElement).toBe(
      radios[2].querySelector('.mlv-radio__native'),
    );
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

describe('MlvRadio hidden native input containment', () => {
  const css = stripCssLayersFromText(
    sass.compile(resolve(dirname(fileURLToPath(import.meta.url)), 'radio.scss'))
      .css,
  );

  // The native input is visually hidden with the `position: absolute` +
  // `clip-path` pattern. An absolutely positioned box is laid out against its
  // nearest *positioned* ancestor — with none inside the control, that is
  // whatever the page happens to provide. Inside a drawer or dialog body it is
  // the scrollbar host *outside* the scroll viewport: the 1px box then sits at
  // its static position in that host's coordinate space, never moves with the
  // viewport's scroll, inflates the body's scrollable overflow and, the moment
  // the label is clicked, makes the browser scroll the `overflow: hidden`
  // body to reveal the focused input — the content jumps out of view while the
  // real viewport stays put. jsdom lays nothing out, so the containing block
  // is pinned through the declaration that establishes it.
  it('is positioned so the visually-hidden native input is contained by the control', () => {
    expect(cssRule(css, '.mlv-radio')).toContain('position: relative');
    expect(cssRule(css, '.mlv-radio__native')).toContain('position: absolute');
  });
});
