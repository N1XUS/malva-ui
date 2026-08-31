import { fileURLToPath } from 'node:url';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { compile } from 'sass';
import { MlvButton } from './button';
import { MlvButtonIcon } from '../button.directives';
import { MlvButtonGroup } from '../button-group/button-group';
import type { MlvButtonShape } from '../button.types';

describe('MlvButton', () => {
  let component: MlvButton;
  let fixture: ComponentFixture<MlvButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvButton],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose a busy, non-interactive loading state', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const button = fixture.nativeElement as HTMLButtonElement;
    expect(component.loading()).toBe(true);
    expect(button.classList.contains('mlv-button--loading')).toBe(true);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    const loader = button.querySelector('mlv-loader');
    expect(loader).toBeTruthy();
    expect(loader?.classList.contains('mlv-loader--indeterminate')).toBe(true);

    const clickEvent = new MouseEvent('click', { cancelable: true });
    button.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
  });

  it('should remove loading state when loading is false', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    const button = fixture.nativeElement as HTMLButtonElement;
    expect(button.classList.contains('mlv-button--loading')).toBe(false);
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.hasAttribute('aria-disabled')).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(button.querySelector('mlv-loader')).toBeNull();
  });
});

describe('MlvButton pressed styling', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = compile(
      // Joined rather than a literal so Vite's static `new URL('literal',
      // import.meta.url)` asset analysis does not rewrite this into a
      // dev-server URL — see editor-block-handle.spec.ts for the same pattern.
      fileURLToPath(new URL(['.', 'button.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  /** Every `CSSStyleRule` the compiled stylesheet declares, in source order. */
  const rules = (): CSSStyleRule[] =>
    [...(style.sheet?.cssRules ?? [])].filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );

  it('renders a visible treatment for the native pressed state', () => {
    const pressed = rules().find(({ selectorText }) =>
      selectorText.includes('aria-pressed'),
    );

    // Matched against real elements rather than compared as a string: jsdom's
    // CSSOM re-serialises `[aria-pressed='true']` without the quotes a browser
    // keeps, so only the targeting itself is portable.
    const button = document.createElement('button');
    button.className = 'mlv-button';
    expect(pressed).toBeDefined();
    expect(button.matches(pressed?.selectorText ?? '')).toBe(false);
    button.setAttribute('aria-pressed', 'false');
    expect(button.matches(pressed?.selectorText ?? '')).toBe(false);
    button.setAttribute('aria-pressed', 'true');
    expect(button.matches(pressed?.selectorText ?? '')).toBe(true);

    // SF-R1: selection is its own token — a persistent pressed state never
    // resolves the pressed/`-active` fill.
    expect(pressed?.style.getPropertyValue('--mlv-btn-bg')).toBe(
      'var(--mlv-background-selected)',
    );
    expect(pressed?.style.getPropertyValue('--mlv-btn-text-color')).toBe(
      'var(--mlv-text-on-selected)',
    );
    // Routed through the component's own shadow variable rather than a direct
    // `box-shadow`, so the base `box-shadow: var(--mlv-btn-box-shadow, none)`
    // channel stays the single place the property is written. Custom property
    // values keep their raw token stream, so the source line wrap survives
    // into the declaration and is collapsed here rather than pinned.
    expect(
      pressed?.style
        .getPropertyValue('--mlv-btn-box-shadow')
        .replace(/\s+/g, ' ')
        .trim(),
    ).toBe('inset 0 0 0 var(--mlv-stroke-width) var(--mlv-border-normal)');
  });

  it('keeps the pressed treatment while the pressed button is hovered', () => {
    // `.mlv-button:hover` and `.mlv-button[aria-pressed='true']` have equal
    // specificity, so a pressed button's background would otherwise depend on
    // which rule Sass emitted last. Pinning the hover custom property makes the
    // resolved background the same either way.
    const pressed = rules().find(({ selectorText }) =>
      selectorText.includes('aria-pressed'),
    );

    expect(pressed?.style.getPropertyValue('--mlv-btn-bg-hover')).toBe(
      'var(--mlv-background-selected-hover)',
    );
  });

  /**
   * A menu button that reflects an active state — an editor's heading trigger
   * showing that the caret sits in an H2 — must not claim the toggle-button
   * ARIA pattern on top of `aria-haspopup`/`aria-expanded`. `--selected` is the
   * visual half of `[aria-pressed='true']` with no ARIA of its own, so it has
   * to share the rule rather than re-declare the recipe next to it.
   */
  it('paints --selected with the same rule as the native pressed state', () => {
    const pressed = rules().find(({ selectorText }) =>
      selectorText.includes('aria-pressed'),
    );
    const button = document.createElement('button');
    button.className = 'mlv-button';

    expect(pressed).toBeDefined();
    expect(button.matches(pressed?.selectorText ?? '')).toBe(false);
    button.classList.add('mlv-button--selected');
    expect(button.matches(pressed?.selectorText ?? '')).toBe(true);

    // Doubled class token, so the selected half carries the same (0,2,0) the
    // attribute half does and cannot lose to `--variant-transparent:hover`.
    expect(pressed?.selectorText).toMatch(
      /\.mlv-button\.mlv-button--selected\b/,
    );
  });

  it('emits --disabled as a doubled class positioned after [aria-pressed] (C2 regression)', () => {
    // A `getComputedStyle` cascade check here would be vacuous: jsdom
    // resolves custom properties by source order alone and ignores CSS
    // specificity entirely, so it would keep "passing" even if `--disabled`
    // were reverted to the old, lower-specificity `.mlv-button--disabled`
    // (0,1,0) — that selector already sat textually after `[aria-pressed]`
    // (0,2,0), which is exactly how the regression rendered a disabled+
    // pressed control as enabled-and-selected in a real browser despite
    // "looking" source-ordered correctly. Assert the two things that
    // actually determine the real-browser cascade winner instead: the
    // disabled rule's selector must carry two `.mlv-button` class tokens
    // (specificity (0,2,0), matching `[aria-pressed='true']`'s
    // class+attribute specificity) and must appear after the pressed rule
    // in source order — mirroring the segmented I1 fix's source-text style.
    const all = rules();
    const pressedIndex = all.findIndex(({ selectorText }) =>
      selectorText.includes('aria-pressed'),
    );
    const disabledIndex = all.findIndex(({ selectorText }) =>
      /\.mlv-button\.mlv-button--disabled\b/.test(selectorText),
    );

    expect(pressedIndex).toBeGreaterThanOrEqual(0);
    expect(disabledIndex).toBeGreaterThanOrEqual(0);
    expect(disabledIndex).toBeGreaterThan(pressedIndex);

    // The disabled rule itself still resolves the declared-surface tokens
    // (this part of the cascade doesn't depend on specificity behaviour —
    // it's just reading the one matching rule's own declarations).
    const disabled = all[disabledIndex];
    expect(disabled.style.getPropertyValue('--mlv-btn-bg')).toBe(
      'var(--mlv-background-disabled)',
    );
    expect(disabled.style.getPropertyValue('--mlv-btn-text-color')).toBe(
      'var(--mlv-text-disabled)',
    );
  });
});

@Component({
  imports: [MlvButton, MlvButtonIcon, MlvButtonGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button id="bare-icon" mlvButton [shape]="shape()" aria-label="Close">
      <svg></svg>
    </button>

    <button id="marked-icon" mlvButton shape="circle" aria-label="Close">
      <svg mlvButtonIcon></svg>
    </button>

    <button id="labelled" mlvButton shape="square">Save</button>

    <button id="text" mlvButton>Save</button>

    <button id="explicit" mlvButton shape="circle" variant="primary">
      <svg></svg>
    </button>

    <mlv-button-group>
      <button id="grouped" mlvButton shape="circle" aria-label="Close">
        <svg></svg>
      </button>
    </mlv-button-group>
  `,
})
class ButtonProjectionHost {
  readonly shape = signal<MlvButtonShape>('circle');
}

describe('MlvButton icon-only inference', () => {
  let fixture: ComponentFixture<ButtonProjectionHost>;

  const button = (id: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`#${id}`) as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonProjectionHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonProjectionHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('infers icon-only from an icon projected without mlvButtonIcon', () => {
    expect(button('bare-icon').classList).toContain('mlv-button--icon-only');
  });

  it('keeps honouring the mlvButtonIcon directive', () => {
    expect(button('marked-icon').classList).toContain('mlv-button--icon-only');
  });

  it('does not treat a square button with a text label as icon-only', () => {
    expect(button('labelled').classList).not.toContain('mlv-button--icon-only');
  });

  it('never marks a default-shaped button icon-only', async () => {
    fixture.componentInstance.shape.set('default');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button('bare-icon').classList).not.toContain(
      'mlv-button--icon-only',
    );
  });
});

describe('MlvButton default variant', () => {
  let fixture: ComponentFixture<ButtonProjectionHost>;

  const button = (id: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`#${id}`) as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonProjectionHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonProjectionHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('falls back to secondary for the icon-only shapes', () => {
    expect(button('bare-icon').classList).toContain(
      'mlv-button--variant-secondary',
    );
    expect(button('labelled').classList).toContain(
      'mlv-button--variant-secondary',
    );
  });

  it('keeps primary for every other shape', () => {
    expect(button('text').classList).toContain('mlv-button--variant-primary');
  });

  it('lets an explicit variant win over the shape default', () => {
    expect(button('explicit').classList).toContain(
      'mlv-button--variant-primary',
    );
  });

  it('lets an ancestor MLV_BUTTON_VARIANT win over the shape default', () => {
    // `mlv-button-group` always provides the token, so its own `primary`
    // fallback resolves before the button's shape-aware default.
    expect(button('grouped').classList).toContain(
      'mlv-button--variant-primary',
    );
  });

  it('follows a shape change back to primary', async () => {
    fixture.componentInstance.shape.set('pill');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button('bare-icon').classList).toContain(
      'mlv-button--variant-primary',
    );
  });
});

describe('MlvButton icon-only styling', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = compile(
      fileURLToPath(new URL(['.', 'button.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  it('sizes an unmarked icon in the label slot like a mlvButtonIcon one', () => {
    const rule = [...(style.sheet?.cssRules ?? [])]
      .filter(
        (cssRule): cssRule is CSSStyleRule => cssRule instanceof CSSStyleRule,
      )
      .find(({ selectorText }) =>
        selectorText.includes('.mlv-button--icon-only .mlv-button__text'),
      );

    expect(rule).toBeDefined();
    expect(rule?.selectorText).toContain('svg:only-child');
    expect(rule?.style.getPropertyValue('width')).toBe(
      'var(--mlv-icon-font-size)',
    );
    expect(rule?.style.getPropertyValue('height')).toBe(
      'var(--mlv-icon-font-size)',
    );
  });
});

describe('MlvButton icon wrapper styling', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = compile(
      fileURLToPath(new URL(['.', 'button.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  it('fills an svg wrapped by a mlvButtonIcon-marked element (e.g. <span mlvButtonIcon><ng-content /></span>)', () => {
    // A projected, unannotated Lucide icon keeps its own fixed
    // `width="24" height="24"` attributes; sizing only the marked wrapper
    // (the `.mlv-button__icon` rule above) never reaches that child svg.
    // This rule makes the svg fill the wrapper's box instead, so it tracks
    // `--mlv-icon-font-size` (and therefore density) too.
    const rule = [...(style.sheet?.cssRules ?? [])]
      .filter(
        (cssRule): cssRule is CSSStyleRule => cssRule instanceof CSSStyleRule,
      )
      .find(({ selectorText }) => selectorText === '.mlv-button__icon > svg');

    expect(rule).toBeDefined();
    expect(rule?.style.getPropertyValue('width')).toBe('100%');
    expect(rule?.style.getPropertyValue('height')).toBe('100%');
  });

  it('does not re-target an svg that is itself the marked element (e.g. mlv-button-close’s <svg mlvButtonIcon />)', () => {
    // `> svg` is a child combinator: it must never match the marked element
    // itself, only a child of it — otherwise a directly-marked svg (the far
    // more common form) would additionally match this rule.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('mlv-button__icon');

    const rule = [...(style.sheet?.cssRules ?? [])]
      .filter(
        (cssRule): cssRule is CSSStyleRule => cssRule instanceof CSSStyleRule,
      )
      .find(({ selectorText }) => selectorText === '.mlv-button__icon > svg');

    expect(rule).toBeDefined();
    expect(svg.matches(rule?.selectorText ?? '')).toBe(false);
  });
});
