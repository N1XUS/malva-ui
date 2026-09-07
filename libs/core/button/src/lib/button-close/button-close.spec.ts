import { fileURLToPath } from 'node:url';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { compile } from 'sass';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvButtonClose } from './button-close';

@Component({
  imports: [MlvButtonClose],
  template: `
    <mlv-button-close ariaLabel="Dismiss notification" />
    <mlv-button-close ariaLabel="Tight close" mlvDensity="tight" />
    <mlv-button-close ariaLabel="Compact close" mlvDensity="compact" />
    <mlv-button-close ariaLabel="Comfortable close" mlvDensity="comfortable" />
    <mlv-button-close ariaLabel="Spacious close" mlvDensity="spacious" />
    <mlv-button-close ariaLabel="Airy close" mlvDensity="airy" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ButtonCloseTestHost {}

describe('MlvButtonClose', () => {
  let fixture: ComponentFixture<ButtonCloseTestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonCloseTestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonCloseTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders a labeled native transparent circle button', () => {
    const host = fixture.nativeElement.querySelector(
      'mlv-button-close',
    ) as HTMLElement;
    const button = host.querySelector('button.mlv-button') as HTMLButtonElement;

    expect(button.classList).toContain('mlv-button--variant-transparent');
    expect(button.classList).toContain('mlv-button--shape-circle');
    expect(button.getAttribute('aria-label')).toBe('Dismiss notification');
    expect(host.hasAttribute('aria-label')).toBe(false);
  });

  it('forwards every supported density to the native button', () => {
    const hosts = fixture.nativeElement.querySelectorAll(
      'mlv-button-close',
    ) as NodeListOf<HTMLElement>;
    const densities = [
      'tight',
      'compact',
      'comfortable',
      'spacious',
      'airy',
    ] as const;

    densities.forEach((density, index) => {
      const button = hosts[index + 1].querySelector(
        'button.mlv-button',
      ) as HTMLButtonElement;
      expect(button.classList).toContain(`mlv-button--${density}`);
    });
  });
});

describe('MlvButtonClose focus ring', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = compile(
      // Joined rather than a literal so Vite's static `new URL('literal',
      // import.meta.url)` asset analysis does not rewrite this into a
      // dev-server URL — see button.spec.ts for the same pattern.
      fileURLToPath(
        new URL(['.', 'button-close.scss'].join('/'), import.meta.url),
      ),
    ).css;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  /** Every `CSSStyleRule` the compiled stylesheet declares, in source order. */
  const rules = (): CSSStyleRule[] =>
    [...(style.sheet?.cssRules ?? [])].filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );

  it('declares its own token focus ring instead of inheriting the UA outline', () => {
    const focusRule = rules().find(({ selectorText }) =>
      selectorText.includes(':focus-visible'),
    );

    expect(focusRule).toBeDefined();
    // Qualified with `.mlv-button` so it outranks the equally specific
    // per-variant `:focus-visible` rules in `button.scss`.
    expect(focusRule?.selectorText).toContain('.mlv-button--close');
    expect(focusRule?.selectorText).toContain('.mlv-button:focus-visible');
    expect(focusRule?.style.getPropertyValue('outline-color')).toBe(
      'var(--mlv-border-focus)',
    );

    const button = document.createElement('button');
    button.className = 'mlv-button mlv-button--close';
    expect(
      button.matches(
        focusRule?.selectorText.replace(':focus-visible', '') ?? '',
      ),
    ).toBe(true);
  });

  it('overrides the icon-only glyph size with a higher-specificity local ratio, not the shared token', () => {
    // The shared --mlv-icon-in-container-ratio (0.45, theme.scss) must stay
    // untouched — every other icon-only button and the tile drag handle read
    // it. This component instead declares its own local ratio and applies it
    // through a compound selector specific enough to beat button.scss's
    // plain `.mlv-button--icon-only` rule regardless of stylesheet order.
    const ratioRule = rules().find(
      ({ selectorText, style: declarations }) =>
        selectorText === '.mlv-button--close' &&
        declarations.getPropertyValue('--mlv-button-close-icon-ratio'),
    );
    expect(ratioRule).toBeDefined();
    const ratio = Number(
      ratioRule?.style.getPropertyValue('--mlv-button-close-icon-ratio'),
    );
    // >= 0.5 so a compact-density (1.75rem) close button clears a ~1rem
    // glyph; well above the shared 0.45 icon-only ratio.
    expect(ratio).toBeGreaterThanOrEqual(0.5);

    const sizeRule = rules().find(({ selectorText }) =>
      selectorText.includes('mlv-button--icon-only'),
    );
    expect(sizeRule).toBeDefined();
    // Compound selector — (0,2,0) — beats button.scss's plain
    // `.mlv-button--icon-only` — (0,1,0) — unconditionally.
    expect(sizeRule?.selectorText).toContain('.mlv-button--close');
    expect(sizeRule?.selectorText).toContain('.mlv-button--icon-only');
    expect(sizeRule?.style.getPropertyValue('--mlv-icon-font-size')).toContain(
      '--mlv-button-close-icon-ratio',
    );

    const button = document.createElement('button');
    button.className = 'mlv-button mlv-button--close mlv-button--icon-only';
    expect(button.matches(sizeRule?.selectorText ?? '')).toBe(true);
  });
});

/**
 * Accessibility sweep — `mlv-button-close`.
 *
 * The component's whole a11y surface is one required input: `ariaLabel` is the
 * only source of the inner button's accessible name, because the button
 * projects nothing but an `aria-hidden` glyph. Density changes geometry only,
 * so the six densities in the host are one state for axe rather than six — but
 * they are swept together, since each renders its own button and a name that
 * failed to reach one of them would show up as a node here.
 */
describe('MlvButtonClose accessibility', () => {
  it('has no axe violations across every density', async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonCloseTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ButtonCloseTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const buttons = [
      ...host.querySelectorAll('button.mlv-button'),
    ] as HTMLButtonElement[];
    expect(buttons).toHaveLength(6);
    // Every close button is named, and nothing inside it contributes text.
    expect(buttons.every((b) => !!b.getAttribute('aria-label'))).toBe(true);
    expect(buttons.every((b) => b.textContent?.trim() === '')).toBe(true);

    await expectNoAxeViolations(host);
  });
});
