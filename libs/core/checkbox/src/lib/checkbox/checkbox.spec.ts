import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvCheckbox } from './checkbox';
import { MlvCheckboxGroup } from '../checkbox-group/checkbox-group';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

@Component({
  template: `
    <mlv-checkbox-group>
      <mlv-checkbox>First</mlv-checkbox>
      <mlv-checkbox [disabled]="true">Disabled</mlv-checkbox>
      <mlv-checkbox>Third</mlv-checkbox>
    </mlv-checkbox-group>
  `,
  imports: [MlvCheckbox, MlvCheckboxGroup],
})
class CheckboxGroupHostComponent {}

@Component({
  template: `
    <mlv-checkbox aria-label="Select row" />
    <mlv-checkbox aria-labelledby="ext-label" />
    <mlv-checkbox [ariaLabel]="dynamicLabel()" aria-label="static loser" />
    <span id="ext-label">External label</span>
  `,
  imports: [MlvCheckbox],
})
class CheckboxAriaHostComponent {
  readonly dynamicLabel = signal('Select row 3');
}

function dispatchArrowDown(element: HTMLElement): void {
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
  });
  Object.defineProperty(event, 'keyCode', { get: () => 40 });
  element.dispatchEvent(event);
}

describe('MlvCheckbox', () => {
  let component: MlvCheckbox;
  let fixture: ComponentFixture<MlvCheckbox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvCheckbox],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvCheckbox);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the native input as the single focus target (host not tabbable)', () => {
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('.mlv-checkbox__native');
    expect(host.getAttribute('tabindex')).toBeNull();
    expect(input?.getAttribute('tabindex')).toBe('0');
    component.focus();
    expect(document.activeElement).toBe(input);
  });

  it('toggles checked on native change and on Enter', () => {
    fixture.detectChanges();
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-checkbox__native');
    // Native change (e.g. Space / click)
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    expect(component.checked()).toBe(true);
    // Enter keydown on the input
    input?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    fixture.detectChanges();
    expect(component.checked()).toBe(false);
  });

  it('forces tabindex -1 on the native input when tabbable is false', () => {
    fixture.componentRef.setInput('tabbable', false);
    fixture.detectChanges();
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-checkbox__native');
    expect(input?.getAttribute('tabindex')).toBe('-1');
  });

  it('does not emit an empty aria-label/aria-labelledby on the input when none is supplied', () => {
    fixture.detectChanges();
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-checkbox__native');
    expect(input?.hasAttribute('aria-label')).toBe(false);
    expect(input?.hasAttribute('aria-labelledby')).toBe(false);
  });

  // `indeterminate` is a DOM property with no HTML attribute, so it is written
  // onto the native input from an `afterRenderEffect` rather than bound in the
  // template — a template binding logged an NG0303 on every server render and
  // dropped nothing useful there, since a DOM property cannot serialise into
  // markup anyway (issue #124). These two cases are what stops that move from
  // silently taking the browser-side property with it: the first pins the
  // initial write, the second pins that later changes still land, which a
  // one-shot `afterNextRender` would not do.
  it('writes the indeterminate DOM property onto the native input', async () => {
    fixture.componentRef.setInput('indeterminate', true);
    await fixture.whenStable();

    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-checkbox__native');
    expect(input?.indeterminate).toBe(true);
    // The attribute half of the tri-state, which is what a server render and a
    // screen reader actually read.
    expect(input?.getAttribute('aria-checked')).toBe('mixed');
  });

  it('tracks later changes to indeterminate on the native input', async () => {
    const input = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('.mlv-checkbox__native');

    fixture.componentRef.setInput('indeterminate', false);
    await fixture.whenStable();
    expect(input?.indeterminate).toBe(false);
    expect(input?.getAttribute('aria-checked')).toBe('false');

    // Ending on `true` is deliberate: `false` is also the DOM default, so a
    // case that stops there passes with the write removed entirely.
    fixture.componentRef.setInput('indeterminate', true);
    await fixture.whenStable();
    expect(input?.indeterminate).toBe(true);
    expect(input?.getAttribute('aria-checked')).toBe('mixed');
  });
});

describe('MlvCheckbox host aria-label/aria-labelledby forwarding', () => {
  let fixture: ComponentFixture<CheckboxAriaHostComponent>;
  let hosts: HTMLElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckboxAriaHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckboxAriaHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    hosts = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-checkbox'),
    );
  });

  it('moves a host aria-label onto the inner input and strips it from the host', () => {
    const host = hosts[0];
    const input = host.querySelector<HTMLInputElement>('.mlv-checkbox__native');
    expect(host.hasAttribute('aria-label')).toBe(false);
    expect(input?.getAttribute('aria-label')).toBe('Select row');
  });

  it('moves a host aria-labelledby onto the inner input and strips it from the host', () => {
    const host = hosts[1];
    const input = host.querySelector<HTMLInputElement>('.mlv-checkbox__native');
    expect(host.hasAttribute('aria-labelledby')).toBe(false);
    expect(input?.getAttribute('aria-labelledby')).toBe('ext-label');
  });

  it('renders the ariaLabel input on the inner input, winning over a static host aria-label, and tracks changes', () => {
    const host = hosts[2];
    const input = host.querySelector<HTMLInputElement>('.mlv-checkbox__native');
    expect(host.hasAttribute('aria-label')).toBe(false);
    expect(input?.getAttribute('aria-label')).toBe('Select row 3');

    fixture.componentInstance.dynamicLabel.set('Select row 4');
    fixture.detectChanges();
    expect(input?.getAttribute('aria-label')).toBe('Select row 4');
  });

  it('has no axe violations', async () => {
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

describe('MlvCheckboxGroup', () => {
  it('should skip disabled checkboxes during arrow navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [CheckboxGroupHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(CheckboxGroupHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const checkboxes = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-checkbox'),
    );

    const firstInput = checkboxes[0].querySelector<HTMLInputElement>(
      '.mlv-checkbox__native',
    );
    firstInput?.focus();
    firstInput?.dispatchEvent(new FocusEvent('focus'));
    dispatchArrowDown(checkboxes[0]);
    fixture.detectChanges();

    // Focus lands on the native input inside the third checkbox, not the host.
    expect(checkboxes[2].contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(
      checkboxes[2].querySelector('.mlv-checkbox__native'),
    );
  });
});

@Component({
  template: `
    <mlv-checkbox label="Newsletter" />
    <mlv-checkbox label="Fallback loser">Projected wins</mlv-checkbox>
  `,
  imports: [MlvCheckbox],
})
class CheckboxLabelHostComponent {}

describe('MlvCheckbox visible label input', () => {
  let fixture: ComponentFixture<CheckboxLabelHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckboxLabelHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(CheckboxLabelHostComponent);
    await fixture.whenStable();
  });

  function boxes(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-checkbox'),
    );
  }

  it('renders the label input as visible text when nothing is projected', () => {
    const labelText = boxes()[0].querySelector(
      '.mlv-checkbox__label-text',
    ) as HTMLElement;
    expect(labelText.textContent?.trim()).toBe('Newsletter');
    expect(
      (
        boxes()[0].querySelector('.mlv-checkbox__label') as HTMLElement
      ).textContent?.trim(),
    ).toBe('Newsletter');
  });

  it('keeps the projected text as the single visible label when both are set', () => {
    const content = boxes()[1].querySelector(
      '.mlv-checkbox__content',
    ) as HTMLElement;
    expect(content.textContent?.trim()).toBe('Projected wins');
    // The fallback stays in the DOM but is display:none-d by the sibling rule,
    // so it never joins the accessible name.
    expect(content.matches(':empty')).toBe(false);
  });

  it('warns in dev mode when nothing labels the checkbox', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const bare = TestBed.createComponent(MlvCheckbox);
    await bare.whenStable();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('mlv-checkbox');
    warn.mockRestore();
  });

  it('sets aria-required on the native input when required', async () => {
    const bare = TestBed.createComponent(MlvCheckbox);
    bare.componentRef.setInput('required', true);
    bare.componentRef.setInput('ariaLabel', 'Accept terms');
    await bare.whenStable();

    expect(
      bare.nativeElement
        .querySelector('.mlv-checkbox__native')
        .getAttribute('aria-required'),
    ).toBe('true');
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

describe('MlvCheckbox hidden native input containment', () => {
  const css = stripCssLayersFromText(
    sass.compile(
      resolve(dirname(fileURLToPath(import.meta.url)), 'checkbox.scss'),
    ).css,
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
    expect(cssRule(css, '.mlv-checkbox')).toContain('position: relative');
    expect(cssRule(css, '.mlv-checkbox__native')).toContain(
      'position: absolute',
    );
  });
});
