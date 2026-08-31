import { MlvColorFromTextPipe } from './color-from-text.pipe';

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

  // AB-R6: every derived fill is a pale tint, because `avatar.scss` renders the
  // initials in the dark `--mlv-palette-neutral-800`. A mid-dark fill puts dark
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
});
