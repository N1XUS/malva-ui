import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvActionBar } from './action-bar';
import { MlvActionBarActions } from './components/action-bar-actions';
import { MlvActionBarLogo } from './components/action-bar-logo';
import { MlvActionBarSpacer } from './components/action-bar-spacer';

describe('MlvActionBar', () => {
  let component: MlvActionBar;
  let fixture: ComponentFixture<MlvActionBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvActionBar],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvActionBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('wrap', () => {
    it('keeps the single-row geometry by default', () => {
      expect(component.wrap()).toBe(false);
      expect(fixture.nativeElement.classList).not.toContain(
        'mlv-action-bar--wrap',
      );
    });

    it('applies the wrap modifier when enabled', async () => {
      fixture.componentRef.setInput('wrap', true);
      await fixture.whenStable();

      expect(component.wrap()).toBe(true);
      expect(fixture.nativeElement.classList).toContain('mlv-action-bar--wrap');
    });

    it('coerces the bare attribute form to true', async () => {
      fixture.componentRef.setInput('wrap', '');
      await fixture.whenStable();

      expect(component.wrap()).toBe(true);
      expect(fixture.nativeElement.classList).toContain('mlv-action-bar--wrap');
    });
  });

  describe('animated', () => {
    it('animates its entrance by default', () => {
      expect(component.animated()).toBe(true);
      expect(fixture.nativeElement.classList).not.toContain(
        'mlv-action-bar--no-animation',
      );
    });

    it('opts the enter and leave keyframes out when disabled', async () => {
      fixture.componentRef.setInput('animated', false);
      await fixture.whenStable();

      expect(component.animated()).toBe(false);
      expect(fixture.nativeElement.classList).toContain(
        'mlv-action-bar--no-animation',
      );
    });

    it('coerces the string attribute form', async () => {
      fixture.componentRef.setInput('animated', 'false');
      await fixture.whenStable();

      expect(component.animated()).toBe(false);
    });
  });
});

/**
 * Accessibility sweep.
 *
 * `[mlvActionBar]` is an attribute component: the host stays the consumer's own
 * element, which in practice is a landmark (`<header>` for the app bar,
 * `<nav>` for the selection bar in
 * `apps/docs/src/app/pages/action-bar/examples/2`). So the sweep is really
 * about what the directive does *not* disturb — the landmark semantics, and the
 * two content markers that render nothing of their own: `[mlvActionBarSpacer]`
 * and `[mlvActionBarActions]`, which sits between named controls and is merely
 * hidden by CSS at narrow widths rather than removed from the tree. Both
 * landmarks are named, because two same-role landmarks on a page have to be
 * distinguishable (`landmark-unique`).
 */
describe('MlvActionBar accessibility', () => {
  @Component({
    imports: [
      MlvActionBar,
      MlvActionBarLogo,
      MlvActionBarSpacer,
      MlvActionBarActions,
    ],
    template: `
      <header mlvActionBar sticky aria-label="Application">
        <a mlvActionBarLogo href="/">Malva</a>
        <div mlvActionBarSpacer></div>
        <div mlvActionBarActions>
          <button type="button">Sign in</button>
          <button type="button" aria-label="Notifications">
            <svg aria-hidden="true"></svg>
          </button>
        </div>
      </header>

      <nav
        mlvActionBar
        fixed
        position="bottom"
        shape="pill"
        contrast
        wrap
        aria-label="Bulk actions"
      >
        <span><strong>3</strong> assets selected</span>
        <div mlvActionBarSpacer></div>
        <button type="button">Move</button>
        <button type="button">Delete</button>
      </nav>
    `,
  })
  class ActionBarA11yHost {}

  it('has no axe violations for a top app bar and a bottom selection bar', async () => {
    await TestBed.configureTestingModule({
      imports: [ActionBarA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(ActionBarA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: the two bars are still the consumer's own landmark elements, each
    // separately named, and both content markers render empty wrappers rather
    // than elements of their own.
    const bars = [...host.querySelectorAll('.mlv-action-bar')];
    expect(bars.map((el) => el.tagName.toLowerCase())).toEqual([
      'header',
      'nav',
    ]);
    expect(bars.map((el) => el.getAttribute('aria-label'))).toEqual([
      'Application',
      'Bulk actions',
    ]);
    const spacers = [...host.querySelectorAll('.mlv-action-bar__spacer')];
    expect(spacers).toHaveLength(2);
    expect(spacers.every((el) => el.childElementCount === 0)).toBe(true);
    expect(host.querySelectorAll('.mlv-action-bar__actions')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });
});
