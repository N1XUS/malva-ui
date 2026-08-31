import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MlvEmptyState } from './empty-state';

@Component({
  template: `
    <mlv-empty-state>
      <ng-container mlvEmptyStateIcon><span id="icon">icon</span></ng-container>
      <span mlvEmptyStateTitle>No items</span>
      <span mlvEmptyStateDescription>Try adjusting your filters.</span>
      <ng-container mlvEmptyStateActions
        ><button id="action">Create</button></ng-container
      >
    </mlv-empty-state>
  `,
  imports: [MlvEmptyState],
})
class TestHostComponent {}

describe('MlvEmptyState', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    el = fixture.nativeElement.querySelector('mlv-empty-state');
  });

  it('should create', () => {
    expect(el).toBeTruthy();
  });

  it('should have mlv-empty-state base class', () => {
    expect(el.classList.contains('mlv-empty-state')).toBe(true);
  });

  it('should have role="status"', () => {
    expect(el.getAttribute('role')).toBe('status');
  });

  it('should project icon content into the icon slot', () => {
    const icon = el.querySelector('#icon');
    expect(icon).toBeTruthy();
    expect(icon?.textContent).toBe('icon');
  });

  it('should project title content', () => {
    const title = el.querySelector('.mlv-empty-state__title');
    expect(title?.textContent?.trim()).toContain('No items');
  });

  it('should project description content', () => {
    const desc = el.querySelector('.mlv-empty-state__description');
    expect(desc?.textContent?.trim()).toContain('Try adjusting your filters.');
  });

  it('should project action content into the actions slot', () => {
    const action = el.querySelector('#action');
    expect(action).toBeTruthy();
    expect(action?.textContent?.trim()).toBe('Create');
  });
});

// ─── Colour contract (WCAG 2.1 AA) ───────────────────────────────────────────

/**
 * Angular attaches no component styles in the test environment and jsdom
 * resolves neither `var()` nor colour, so axe's `color-contrast` rule cannot
 * see these values. The token each part reads is therefore asserted from the
 * stylesheet source and the ratio it resolves to is computed from
 * `libs/styles`' own palette.
 *
 * The regression this guards: the description was painted with
 * `--mlv-text-tertiary` — 2.31:1 on `--mlv-background-sunken` in light and
 * 4.18:1 in dark, both below the 4.5:1 floor, and a token
 * `.claude/rules/accessibility.md` forbids for meaningful text outright.
 *
 * `new URL(…, import.meta.url)` is rewritten by Vite into an asset URL, so
 * both files are resolved from this spec's own path instead.
 */
const specPath = fileURLToPath(import.meta.url);

const emptyStateScss = readFileSync(
  specPath.replace(/\.spec\.ts$/, '.scss'),
  'utf8',
)
  // The comments in the stylesheet name the very token these assertions rule
  // out, so they would otherwise satisfy the checks on their own.
  .replace(/^\s*\/\/.*$/gm, '');

const themeScss = readFileSync(
  specPath.replace(
    /src\/lib\/empty-state\/empty-state\.spec\.ts$/,
    '../../styles/src/lib/theme.scss',
  ),
  'utf8',
);

/** Resolves a `--mlv-*` colour token to a hex string for one theme. */
function tokenHex(token: string, theme: 'light' | 'dark'): string {
  const lightStart = themeScss.indexOf('  :root,');
  const darkStart = themeScss.indexOf('@mixin dark-tokens');
  const darkEnd = themeScss.indexOf("[data-theme='high-contrast']");
  expect(lightStart, 'light token block').toBeGreaterThan(-1);
  expect(darkStart, 'dark token block').toBeGreaterThan(lightStart);
  expect(darkEnd, 'high-contrast block').toBeGreaterThan(darkStart);

  const section =
    theme === 'light'
      ? themeScss.slice(lightStart, darkStart)
      : themeScss.slice(darkStart, darkEnd);

  const read = (name: string, from: string): string => {
    const value = new RegExp(`${name}:\\s*([^;]+);`).exec(from)?.[1]?.trim();
    expect(value, `${name} in ${theme} theme`).toBeTruthy();
    return value as string;
  };

  let value = read(token, section);
  // Semantic tokens point at the palette (`var(--mlv-palette-neutral-600)`),
  // which is itself interpolated from a Sass variable at the top of the file.
  const paletteRef = /^var\((--mlv-palette-[a-z0-9-]+)\)$/.exec(value);
  if (paletteRef) {
    const interpolated = read(paletteRef[1], themeScss);
    const sassVar = /^#\{\$(mlv-palette-[a-z0-9-]+)\}$/.exec(interpolated);
    value = sassVar ? read(`\\$${sassVar[1]}`, themeScss).trim() : interpolated;
  }
  expect(value, `${token} in ${theme} theme`).toMatch(/^#[0-9a-f]{6}$/i);
  return value;
}

/** WCAG 2.1 relative-luminance contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string): number =>
    [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);

  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('MlvEmptyState — colour contract', () => {
  it('paints the description with the supporting-copy ramp', () => {
    expect(emptyStateScss).toContain(
      `&__description {
    font-family: var(--mlv-typography-family-text);
    font-size: var(--mlv-font-size-m);
    color: var(--mlv-text-secondary);`,
    );
  });

  it('keeps the quiet ramps off every text part', () => {
    // Only the decorative icon slot may read `--mlv-text-tertiary`.
    const textParts = emptyStateScss.slice(emptyStateScss.indexOf('&__body'));
    expect(textParts).not.toContain('--mlv-text-tertiary');
    expect(textParts).not.toContain('--mlv-text-disabled');
    expect(emptyStateScss.match(/--mlv-text-tertiary/g)?.length).toBe(1);
  });

  it.each([
    ['light' as const, '--mlv-background-base'],
    ['light' as const, '--mlv-background-raised'],
    ['light' as const, '--mlv-background-sunken'],
    ['dark' as const, '--mlv-background-base'],
    ['dark' as const, '--mlv-background-raised'],
    ['dark' as const, '--mlv-background-sunken'],
  ])(
    'clears WCAG AA for title and description in %s on %s',
    (theme, background) => {
      const bg = tokenHex(background, theme);
      for (const token of ['--mlv-text-primary', '--mlv-text-secondary']) {
        expect(
          contrast(tokenHex(token, theme), bg),
          `${token} on ${background} (${theme})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('records why the previous token had to go', () => {
    // The exact failure the fix removes, so the numbers stay honest.
    const light = contrast(
      tokenHex('--mlv-text-tertiary', 'light'),
      tokenHex('--mlv-background-sunken', 'light'),
    );
    const dark = contrast(
      tokenHex('--mlv-text-tertiary', 'dark'),
      tokenHex('--mlv-background-sunken', 'dark'),
    );
    expect(light).toBeLessThan(4.5);
    expect(dark).toBeLessThan(4.5);
    expect(Number(light.toFixed(2))).toBe(2.31);
    expect(Number(dark.toFixed(2))).toBe(4.18);
  });
});
