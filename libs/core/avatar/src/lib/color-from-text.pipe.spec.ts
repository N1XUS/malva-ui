import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';
import { MlvColorFromTextPipe } from './color-from-text.pipe';

/** Directory of this spec — the `@nx/vitest:test` executor runs with cwd = workspace root. */
const LIB_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * The `opacity` the shipped stylesheet gives `.mlv-avatar__initials`, or 1.
 * Compiled CSS is flat — a rule block holds no nested braces — so the block
 * runs from the selector's `{` to the next `}`.
 */
function initialsOpacity(): number {
  const css = sass
    .compile(join(LIB_DIR, 'avatar/avatar.scss'), { style: 'expanded' })
    .css.replace(/\s+/g, '');
  const needle = '.mlv-avatar__initials{';
  const start = css.indexOf(needle);
  if (start === -1)
    throw new Error('`.mlv-avatar__initials` rule not found in avatar.scss');
  const block = css.slice(start + needle.length, css.indexOf('}', start));
  const match = /(?:^|;)opacity:([\d.]+)/.exec(block);
  return match ? Number(match[1]) : 1;
}

describe('MlvColorFromTextPipe', () => {
  let pipe: MlvColorFromTextPipe;

  beforeEach(() => {
    pipe = new MlvColorFromTextPipe();
  });

  describe('output format', () => {
    it('should return a value matching hsl(...) format', () => {
      const result = pipe.transform('John Doe');
      expect(result).toMatch(/^hsl\(\d+,\d+%,\d+%\)$/);
    });

    it('should return the default color for null input', () => {
      expect(pipe.transform(null)).toBe('hsl(210,60%,80%)');
    });

    it('should return the default color for undefined input', () => {
      expect(pipe.transform(undefined)).toBe('hsl(210,60%,80%)');
    });

    it('should return the default color for empty string', () => {
      expect(pipe.transform('')).toBe('hsl(210,60%,80%)');
    });

    it('should emit the fallback in the same format as a hashed value', () => {
      expect(pipe.transform(null)).toMatch(/^hsl\(\d+,\d+%,\d+%\)$/);
    });
  });

  // AB-R6: every derived fill is a pale tint, because `mlv-avatar` paints a
  // tinted avatar's initials in the dark `--mlv-palette-neutral-800`. A mid-dark fill puts dark
  // text on a dark ground (~3.0:1, under AA). The fallback is inside the band
  // too — it used to sit at 45% while the hashed path was retuned to ~80%.
  describe('pale-tint band (AB-R6)', () => {
    const lightnessOf = (color: string): number =>
      Number(/,(\d+)%\)$/.exec(color)?.[1]);

    it('should keep hashed lightness in the pale band', () => {
      for (const name of ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Zoë']) {
        const lightness = lightnessOf(pipe.transform(name));
        expect(lightness).toBeGreaterThanOrEqual(76);
        expect(lightness).toBeLessThanOrEqual(84);
      }
    });

    it('should keep the empty-input fallback in the same pale band', () => {
      const lightness = lightnessOf(pipe.transform(''));
      expect(lightness).toBeGreaterThanOrEqual(76);
      expect(lightness).toBeLessThanOrEqual(84);
    });
  });

  describe('determinism', () => {
    it('should return the same color for the same input', () => {
      const result1 = pipe.transform('John Doe');
      const result2 = pipe.transform('John Doe');
      expect(result1).toBe(result2);
    });

    it('should return the same color for the same input on multiple calls', () => {
      const inputs = ['Alice', 'Bob', 'John Michael Doe', 'test@example.com'];
      for (const input of inputs) {
        const result1 = pipe.transform(input);
        const result2 = pipe.transform(input);
        expect(result1).toBe(result2);
      }
    });
  });

  describe('uniqueness', () => {
    it('should return different colors for different inputs', () => {
      const result1 = pipe.transform('Alice');
      const result2 = pipe.transform('Bob');
      expect(result1).not.toBe(result2);
    });

    it('should produce different hues for different names', () => {
      const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
      const colors = names.map((name) => pipe.transform(name));
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(names.length);
    });
  });

  // #302: `mlv-avatar` paints a tinted avatar's initials and projected content
  // in the opaque `--mlv-palette-neutral-800` (#262626 in every theme — the
  // tint is theme-independent, so its foreground has to be too). The old
  // 0.8 opacity dropped the worst tint in this band to 4.29:1.
  describe('tint contrast (#302)', () => {
    /** Tint foreground: `$mlv-palette-neutral-800`, pinned by theme-contrast.spec.mjs. */
    const FOREGROUND: [number, number, number] = [0x26, 0x26, 0x26];

    const parse = (color: string): [number, number, number] => {
      const match = /^hsl\((\d+),(\d+)%,(\d+)%\)$/.exec(color);
      if (!match) throw new Error(`not an hsl() colour: ${color}`);
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    };

    /** CSS Color 4 `hsl()` → sRGB, 0–255. */
    const toRgb = ([h, s, l]: [number, number, number]): number[] => {
      const sat = s / 100;
      const light = l / 100;
      const channel = (n: number): number => {
        const k = (n + h / 30) % 12;
        const a = sat * Math.min(light, 1 - light);
        return (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
      };
      return [channel(0), channel(8), channel(4)];
    };

    /** WCAG 2.1 relative luminance. */
    const luminance = (rgb: number[]): number => {
      const [r, g, b] = rgb.map((v) => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const contrast = (a: number[], b: number[]): number => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    it('keeps every hashed tint inside the band swept below', () => {
      // `hash % 5` is signed, so saturation and lightness move together by
      // k ∈ [-4, 4]: (56%, 76%) … (64%, 84%).
      for (let i = 0; i < 5000; i++) {
        const [h, s, l] = parse(
          pipe.transform(`user-${i}·${String.fromCharCode(0x41 + (i % 900))}`),
        );
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
        expect(s - 60).toBe(l - 80);
        expect(Math.abs(l - 80)).toBeLessThanOrEqual(4);
      }
    });

    it('carries the tinted initials at AA on every colour the pipe can emit', () => {
      // Composite the glyph colour over the tint at the stylesheet's own
      // initials opacity (sRGB, as the browser blends), so reintroducing a
      // translucent foreground fails here rather than only in a browser.
      const alpha = initialsOpacity();
      const failing: string[] = [];
      const band = ['hsl(210,60%,80%)'];
      for (let h = 0; h < 360; h++)
        for (let k = -4; k <= 4; k++)
          band.push(`hsl(${h},${60 + k}%,${80 + k}%)`);
      for (const color of band) {
        const tint = toRgb(parse(color));
        const glyph = FOREGROUND.map(
          (channel, i) => alpha * channel + (1 - alpha) * tint[i],
        );
        const ratio = contrast(glyph, tint);
        if (ratio < 4.5) failing.push(`${color} = ${ratio.toFixed(2)}`);
      }
      expect(failing).toEqual([]);
    });
  });
});
