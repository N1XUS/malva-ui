import {
  chooseContrastForeground,
  compositeColors,
  contrastRatio,
  parseComputedColor,
  toCssColor,
} from './chrome-color.util';

describe('parseComputedColor', () => {
  it('parses browser-computed rgb colors', () => {
    expect(parseComputedColor('rgb(255, 128, 0)')).toEqual({
      red: 255,
      green: 128,
      blue: 0,
      alpha: 1,
    });
  });

  it('parses legacy rgba and modern slash-alpha syntax', () => {
    expect(parseComputedColor('rgba(113, 56, 208, 0.5)')).toEqual({
      red: 113,
      green: 56,
      blue: 208,
      alpha: 0.5,
    });
    expect(parseComputedColor('rgb(113 56 208 / 50%)')).toEqual({
      red: 113,
      green: 56,
      blue: 208,
      alpha: 0.5,
    });
  });

  it('parses transparent and rejects invalid or out-of-range values', () => {
    expect(parseComputedColor('transparent')).toEqual({
      red: 0,
      green: 0,
      blue: 0,
      alpha: 0,
    });
    expect(parseComputedColor('not-a-color')).toBeNull();
    expect(parseComputedColor('rgb(256, 0, 0)')).toBeNull();
    expect(parseComputedColor('rgba(0, 0, 0, 1.1)')).toBeNull();
  });
});

describe('color composition and serialization', () => {
  it('composites translucent foregrounds over opaque backgrounds', () => {
    const result = compositeColors(
      { red: 255, green: 255, blue: 255, alpha: 0.5 },
      { red: 0, green: 0, blue: 0, alpha: 1 },
    );

    expect(result).toEqual({
      red: 127.5,
      green: 127.5,
      blue: 127.5,
      alpha: 1,
    });
    expect(toCssColor(result)).toBe('rgb(127.5, 127.5, 127.5)');
  });

  it('serializes alpha only when the color is translucent', () => {
    expect(toCssColor({ red: 113, green: 56, blue: 208, alpha: 0.5 })).toBe(
      'rgba(113, 56, 208, 0.5)',
    );
  });
});

describe('chooseContrastForeground', () => {
  it('selects black for light backgrounds and white for dark backgrounds', () => {
    expect(
      chooseContrastForeground({
        red: 250,
        green: 250,
        blue: 250,
        alpha: 1,
      }),
    ).toBe('rgb(0, 0, 0)');
    expect(
      chooseContrastForeground({
        red: 23,
        green: 23,
        blue: 23,
        alpha: 1,
      }),
    ).toBe('rgb(255, 255, 255)');
  });

  it('chooses an endpoint with at least WCAG AA contrast', () => {
    const background = {
      red: 117,
      green: 117,
      blue: 117,
      alpha: 1,
    };
    const foreground =
      chooseContrastForeground(background) === 'rgb(0, 0, 0)'
        ? { red: 0, green: 0, blue: 0, alpha: 1 }
        : { red: 255, green: 255, blue: 255, alpha: 1 };

    expect(contrastRatio(background, foreground)).toBeGreaterThanOrEqual(4.5);
  });
});
