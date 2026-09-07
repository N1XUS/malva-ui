import { fileURLToPath } from 'node:url';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { compile } from 'sass';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvBadge } from './badge';
import { MlvBadgeIcon } from '../badge-icon';

describe('MlvBadge', () => {
  let component: MlvBadge;
  let fixture: ComponentFixture<MlvBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvBadge],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvBadge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

@Component({
  imports: [MlvBadge, MlvBadgeIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-badge id="leading" tone="success" muted>
      <svg mlvBadgeIcon></svg>
      Published
    </mlv-badge>

    <mlv-badge id="trailing" tone="info">
      Syncing
      <svg mlvBadgeIcon position="end"></svg>
    </mlv-badge>

    <mlv-badge id="plain" tone="default">Draft</mlv-badge>
  `,
})
class BadgeIconHost {}

describe('MlvBadgeIcon', () => {
  let fixture: ComponentFixture<BadgeIconHost>;

  const badge = (id: string): HTMLElement =>
    fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeIconHost],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeIconHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('marks the icon slot and hides it from assistive technology', () => {
    const icon = badge('leading').querySelector('svg') as SVGElement;

    expect(icon.classList).toContain('mlv-badge__icon');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.classList).not.toContain('mlv-badge__icon--end');
  });

  it('flags a trailing icon so CSS can reorder it', () => {
    const icon = badge('trailing').querySelector('svg') as SVGElement;

    expect(icon.classList).toContain('mlv-badge__icon--end');
  });

  it('projects the icon into its own slot ahead of the label', () => {
    // `<ng-content select="[mlvBadgeIcon]">` comes first in the template, so
    // the icon is hoisted out of the default slot regardless of where the
    // consumer declared it. `position="end"` then reorders it visually.
    const trailing = badge('trailing');

    expect(trailing.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(trailing.textContent?.trim()).toBe('Syncing');
  });

  it('adds the gap modifier only when an icon is projected', () => {
    expect(badge('leading').classList).toContain('mlv-badge--with-icon');
    expect(badge('trailing').classList).toContain('mlv-badge--with-icon');
    expect(badge('plain').classList).not.toContain('mlv-badge--with-icon');
  });

  it('keeps the tone and muted modifiers alongside the icon modifier', () => {
    expect(badge('leading').classList).toContain('mlv-badge--tone-success');
    expect(badge('leading').classList).toContain('mlv-badge--muted');
  });
});

describe('MlvBadge icon styling', () => {
  let style: HTMLStyleElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = compile(
      // Joined rather than a literal so Vite's static `new URL('literal',
      // import.meta.url)` asset analysis does not rewrite this into a
      // dev-server URL.
      fileURLToPath(new URL(['.', 'badge.scss'].join('/'), import.meta.url)),
    ).css;
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  /** Every `CSSStyleRule` the compiled stylesheet declares, in source order. */
  const rules = (): CSSStyleRule[] =>
    [...(style.sheet?.cssRules ?? [])].filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );

  const rule = (selector: string): CSSStyleRule | undefined =>
    rules().find(({ selectorText }) => selectorText === selector);

  it('sizes the icon from the density-driven font size', () => {
    const icon = rule('.mlv-badge__icon');

    expect(icon?.style.getPropertyValue('width')).toBe(
      'var(--mlv-badge-icon-size)',
    );
    expect(icon?.style.getPropertyValue('height')).toBe(
      'var(--mlv-badge-icon-size)',
    );
    expect(
      rule('.mlv-badge')?.style.getPropertyValue('--mlv-badge-icon-size'),
    ).toBe('1em');
  });

  it('gaps the label only for badges that project an icon', () => {
    expect(rule('.mlv-badge--with-icon')?.style.getPropertyValue('gap')).toBe(
      'var(--mlv-badge-gap)',
    );
    expect(rule('.mlv-badge')?.style.getPropertyValue('gap')).toBe('');
  });

  it('reorders a trailing icon after the label', () => {
    expect(rule('.mlv-badge__icon--end')?.style.getPropertyValue('order')).toBe(
      '1',
    );
  });
});

/**
 * Accessibility sweep.
 *
 * A badge adds no role and no ARIA of its own — what it does add is a projected
 * `[mlvBadgeIcon]` that the directive marks `aria-hidden="true"`, which is only
 * correct while the badge still has a text label beside it. So the sweep covers
 * the whole tone × muted matrix the docs page promotes
 * (`apps/docs/src/app/pages/badge/examples/1`, `…/2`) together with both icon
 * positions (`…/6`) and a density override (`…/3`), and asserts that every
 * badge keeps an accessible text of its own next to the hidden glyph.
 */
@Component({
  imports: [MlvBadge, MlvBadgeIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (tone of tones; track tone) {
      <mlv-badge [tone]="tone">{{ tone }}</mlv-badge>
      <mlv-badge [tone]="tone" muted>{{ tone }} muted</mlv-badge>
    }

    <mlv-badge tone="success" muted>
      <svg mlvBadgeIcon></svg>
      Published
    </mlv-badge>

    <mlv-badge tone="info">
      Syncing
      <svg mlvBadgeIcon position="end"></svg>
    </mlv-badge>

    <mlv-badge tone="primary" muted mlvDensity="compact">New</mlv-badge>
    <mlv-badge tone="primary" muted mlvDensity="spacious">New</mlv-badge>
  `,
})
class BadgeA11yHost {
  readonly tones = [
    'default',
    'primary',
    'secondary',
    'accent',
    'success',
    'info',
    'warning',
    'danger',
  ] as const;
}

describe('MlvBadge accessibility', () => {
  it('has no axe violations across tones, icons and density', async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(BadgeA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: the eight tones twice over, both icon positions and two density
    // overrides — 20 badges, every one of them still carrying visible text.
    const badges = [...host.querySelectorAll('mlv-badge')];
    expect(badges).toHaveLength(20);
    expect(badges.every((b) => (b.textContent ?? '').trim().length > 0)).toBe(
      true,
    );
    expect(host.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);

    await expectNoAxeViolations(host);
  });
});
