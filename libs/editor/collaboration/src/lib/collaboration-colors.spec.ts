import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MLV_EDITOR_COLLABORATION_COLORS } from './collaboration-colors';
import {
  mlvEditorCollaborationLabelColor,
  mlvEditorRelativeLuminance,
} from './collaboration-palette';

/*
 * F-D18 / U7: every palette colour keeps WCAG 1.4.11's 3:1 against each
 * surface a caret is painted on, in both themes, and its label keeps 1.4.3's
 * 4.5:1. The surfaces are read from the theme source, not restated, so a
 * token change that breaks the palette turns this red.
 */

const THEME = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../styles/src/lib/theme.scss',
);

/** WCAG contrast ratio of two `#rrggbb` colours. */
const contrast = (a: string, b: string): number => {
  const [high, low] = [
    mlvEditorRelativeLuminance(a),
    mlvEditorRelativeLuminance(b),
  ].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

/** A `$mlv-palette-*` SCSS variable's hex value. */
function paletteVariable(source: string, name: string): string {
  const match = new RegExp(`\\$${name}:\\s*(#[0-9a-fA-F]{6})`).exec(source);
  if (!match) throw new Error(`theme.scss has no $${name}`);
  return match[1].toLowerCase();
}

describe('MLV_EDITOR_COLLABORATION_COLORS', () => {
  const theme = readFileSync(THEME, 'utf8');
  const surfaces = {
    'light base (neutral-50)': paletteVariable(theme, 'mlv-palette-neutral-50'),
    'light editor surface': '#ffffff',
    'dark base (neutral-900)': paletteVariable(
      theme,
      'mlv-palette-neutral-900',
    ),
    'dark editor surface (elevation-bg-3)': '#333333',
  };

  it('reads the surfaces the carets are painted on', () => {
    expect(surfaces['light base (neutral-50)']).toBe('#fafafa');
    expect(surfaces['dark base (neutral-900)']).toBe('#171717');
    // The dark editor surface is `--mlv-elevation-bg-3`, declared literally.
    expect(theme).toMatch(/--mlv-elevation-bg-3:\s*#333333/);
  });

  it('holds twelve distinct `#rrggbb` colours', () => {
    expect(MLV_EDITOR_COLLABORATION_COLORS).toHaveLength(12);
    expect(new Set(MLV_EDITOR_COLLABORATION_COLORS).size).toBe(12);
    for (const color of MLV_EDITOR_COLLABORATION_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps every caret bar at 3:1 or more on every surface (1.4.11)', () => {
    const failures: string[] = [];
    for (const color of MLV_EDITOR_COLLABORATION_COLORS) {
      for (const [surface, value] of Object.entries(surfaces)) {
        const ratio = contrast(color, value);
        if (ratio < 3)
          failures.push(`${color} on ${surface}: ${ratio.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps every label at 4.5:1 or more on its caret colour (1.4.3)', () => {
    const failures: string[] = [];
    for (const color of MLV_EDITOR_COLLABORATION_COLORS) {
      const ratio = contrast(color, mlvEditorCollaborationLabelColor(color));
      if (ratio < 4.5) failures.push(`${color}: ${ratio.toFixed(2)}`);
    }
    expect(failures).toEqual([]);
  });

  it('picks the better of black and white for any colour', () => {
    for (const color of [
      '#000000',
      '#ffffff',
      '#777777',
      '#0000ff',
      '#ffff00',
    ]) {
      expect(
        contrast(color, mlvEditorCollaborationLabelColor(color)),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
