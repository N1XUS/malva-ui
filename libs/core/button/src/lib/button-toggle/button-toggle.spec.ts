import { fileURLToPath } from 'node:url';
import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { compile } from 'sass';
import { MlvButtonGroup } from '../button-group/button-group';
import { MlvButtonToggle } from './button-toggle';

@Component({
  imports: [MlvButtonGroup, MlvButtonToggle],
  template: `
    <mlv-button-group variant="secondary" aria-label="Text alignment">
      <mlv-button-toggle mlvDensity="compact" [(pressed)]="pressed">
        Bold
      </mlv-button-toggle>
      <mlv-button-toggle disabled>Italic</mlv-button-toggle>
    </mlv-button-group>
  `,
})
class ButtonToggleTestHost {
  readonly pressed = signal(false);
}

describe('MlvButtonToggle', () => {
  let fixture: ComponentFixture<ButtonToggleTestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonToggleTestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonToggleTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('uses native pressed-button semantics and supports two-way state', () => {
    const toggle = fixture.nativeElement.querySelector('mlv-button-toggle');
    const button = toggle.querySelector('button');

    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.pressed()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.classList).toContain('mlv-button-toggle--pressed');
  });

  it('inherits the enclosing group variant', () => {
    const button = fixture.nativeElement.querySelector('button.mlv-button');
    expect(button.classList).toContain('mlv-button--variant-secondary');
  });

  it('forwards density to the inner button', () => {
    const button = fixture.nativeElement.querySelector('button.mlv-button');
    expect(button.classList).toContain('mlv-button--compact');
  });

  it('does not change a disabled toggle', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button.mlv-button');
    buttons[1].click();
    fixture.detectChanges();
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });
});

describe('MlvButtonToggle disabled+pressed styling', () => {
  // `.mlv-button-toggle--pressed > .mlv-button` (button-toggle.scss) and
  // `.mlv-button.mlv-button--disabled` (button.scss) are both (0,2,0) but
  // live in different stylesheets, so which one wins depends on Angular's
  // per-component `<style>` injection order — not something a source-text
  // assertion inside a single file can prove either way. A real cascade
  // check (getComputedStyle) is unreliable here too: jsdom resolves custom
  // properties by source order alone, not specificity, so it cannot tell a
  // deterministic fix apart from one that only happens to work in the
  // current injection order. Assert the emitted selector's specificity
  // directly instead — the disabled+pressed qualifier must compile to three
  // classes, `(0,3,0)`, which unconditionally outranks any `(0,2,0)` rule
  // regardless of stylesheet order.
  it('emits a three-class disabled+pressed selector that outranks any (0,2,0) rule', () => {
    const css = compile(
      fileURLToPath(
        new URL(['.', 'button-toggle.scss'].join('/'), import.meta.url),
      ),
    ).css;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const rules = [...(style.sheet?.cssRules ?? [])].filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );
    const disabledPressed = rules.find(({ selectorText }) =>
      /\.mlv-button-toggle--disabled\.mlv-button-toggle--pressed\s*>\s*\.mlv-button/.test(
        selectorText,
      ),
    );

    expect(disabledPressed).toBeDefined();
    expect(disabledPressed?.style.getPropertyValue('--mlv-btn-bg')).toBe(
      'var(--mlv-background-disabled)',
    );
    expect(
      disabledPressed?.style.getPropertyValue('--mlv-btn-text-color'),
    ).toBe('var(--mlv-text-disabled)');

    style.remove();
  });
});
