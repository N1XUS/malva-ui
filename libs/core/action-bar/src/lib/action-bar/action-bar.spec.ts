import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvActionBar } from './action-bar';
import { MlvActionBarActions } from './components/action-bar-actions';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvActionBarLogo } from './components/action-bar-logo';

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
 * The bar's surface is the same one `mlv-page-header`, `mlv-page-summary` and
 * `mlv-page-dock` paint (`libs/core/page/.../page-chrome-surface.spec.ts`
 * carries their half): a flat fill on `--mlv-background-bar`, stepping one rung
 * to `--mlv-background-bar-overlapped` when the bar is pinned — which is when
 * it is over content by construction, and the reason it is pinned at all.
 *
 * It used to be a translucent `elevation-bg-3` fill behind
 * `backdrop-filter: blur(1.25rem)`, under a hairline, under a shadow. Four
 * signals for one statement, and `mlv-page-shell` had to unset two of them by
 * hand on its own topbar.
 *
 * Losing the blur is not cosmetic: `backdrop-filter` establishes a containing
 * block for `position: fixed` descendants, so an overlay a consumer rendered
 * inside a bar was anchored to the bar rather than to the viewport.
 *
 * Component styles are not injected into the DOM under the vitest/jsdom setup,
 * so the compiled stylesheet is the observable surface here.
 */
describe('MlvActionBar — chrome surface', () => {
  // Comments stripped as well as whitespace: the selector-group capture below
  // would otherwise pick up the banner comment sitting above a rule.
  const css = sass
    .compile(join(dirname(fileURLToPath(import.meta.url)), 'action-bar.scss'), {
      style: 'expanded',
    })
    .css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, '');

  it('paints the shared chrome-bar fill', () => {
    expect(css).toContain('--mlv-action-bar-bg:var(--mlv-background-bar);');
  });

  it('steps one rung up while pinned over content', () => {
    for (const modifier of ['fixed', 'sticky']) {
      const selector = `.mlv-action-bar--${modifier}{`;
      const open = css.indexOf(selector);

      expect(open, `selector \`${selector}\` not found`).toBeGreaterThan(-1);
      expect(
        css.slice(open + selector.length, css.indexOf('}', open)),
      ).toContain('--mlv-action-bar-bg:var(--mlv-background-bar-overlapped);');
    }
  });

  it('paints no backdrop filter outside the deliberate glass variant', () => {
    // `--contrast` is a smoked-glass surface a consumer opts into, so its blur
    // is the point rather than a separation signal stacked on three others.
    // Every other rule is flat, which is what frees `position: fixed` inside a
    // bar to anchor to the viewport again.
    const blurred = [...css.matchAll(/([^{}]+)\{[^{}]*backdrop-filter:/g)].map(
      (match) => match[1],
    );

    expect(blurred).toEqual(['.mlv-action-bar--contrast']);
  });

  it('leaves the shadow knob unset rather than deleting it', () => {
    // A consumer that set `--mlv-action-bar-shadow` keeps winning; read with a
    // fallback rather than declared on the block, because an element's own
    // declaration would beat the inherited override.
    expect(css).toContain('box-shadow:var(--mlv-action-bar-shadow,none);');
    expect(css).not.toContain(
      '--mlv-action-bar-shadow:var(--mlv-shadow-raised)',
    );
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
 * one content marker that renders nothing of its own, `[mlvActionBarActions]`,
 * which sits between named controls and is merely
 * hidden by CSS at narrow widths rather than removed from the tree. Both
 * landmarks are named, because two same-role landmarks on a page have to be
 * distinguishable (`landmark-unique`).
 */
describe('MlvActionBar accessibility', () => {
  @Component({
    imports: [MlvActionBar, MlvActionBarLogo, MlvSpacer, MlvActionBarActions],
    template: `
      <header mlvActionBar sticky aria-label="Application">
        <a mlvActionBarLogo href="/">Malva</a>
        <mlv-spacer />
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
        <mlv-spacer />
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
    const spacers = [...host.querySelectorAll('.mlv-spacer')];
    expect(spacers).toHaveLength(2);
    expect(spacers.every((el) => el.childElementCount === 0)).toBe(true);
    expect(host.querySelectorAll('.mlv-action-bar__actions')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });
});
