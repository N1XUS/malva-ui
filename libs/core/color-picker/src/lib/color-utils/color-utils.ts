/**
 * Represents a color in HSL + Alpha space.
 * All values are stored internally in this format for canvas rendering.
 */
export interface MlvHsla {
  /** Hue: 0–360 */
  h: number;
  /** Saturation: 0–100 */
  s: number;
  /** Lightness: 0–100 */
  l: number;
  /** Alpha: 0–1 */
  a: number;
}

/** Represents a color in RGBA space. */
export interface MlvRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** The color input mode for the text tabs. */
export type MlvColorInputMode = 'hex' | 'rgb' | 'hsl';

/**
 * Clamps a number to the range [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rounds a number to a given number of decimal places.
 */
export function round(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Converts HSL (0-360, 0-100, 0-100) to RGB (0-255 each).
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  };
}

/**
 * Converts RGB (0-255) to HSL (0-360, 0-100, 0-100).
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = h * 60;
    if (h < 0) h += 360;
  }

  return {
    h: round(h, 1),
    s: round(s * 100, 1),
    l: round(l * 100, 1),
  };
}

/**
 * Converts a hex string (#RRGGBB or #RRGGBBAA) to RGBA.
 * Returns null if the hex string is invalid.
 */
export function hexToRgba(hex: string): MlvRgba | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6 && cleaned.length !== 8) return null;
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  const a =
    cleaned.length === 8 ? parseInt(cleaned.substring(6, 8), 16) / 255 : 1;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b, a };
}

/**
 * Converts RGBA to a hex string.
 * Includes alpha channel as #RRGGBBAA if alpha < 1.
 */
export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number): string =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a < 1) {
    return hex + toHex(a * 255);
  }
  return hex;
}

/**
 * Converts an HSLa object to a CSS color string.
 * Produces hsla() when alpha < 1, otherwise hsl().
 */
export function hslaToString(color: MlvHsla): string {
  const { h, s, l, a } = color;
  if (a < 1) {
    return `hsla(${round(h, 1)}, ${round(s, 1)}%, ${round(l, 1)}%, ${round(a, 2)})`;
  }
  return `hsl(${round(h, 1)}, ${round(s, 1)}%, ${round(l, 1)}%)`;
}

/**
 * Converts an HSLa object to an RGBA object.
 */
export function hslaToRgba(color: MlvHsla): MlvRgba {
  const { r, g, b } = hslToRgb(color.h, color.s, color.l);
  return { r, g, b, a: color.a };
}

/**
 * Converts an HSLa object to a hex string (#RRGGBB or #RRGGBBAA).
 */
export function hslaToHex(color: MlvHsla): string {
  const { r, g, b } = hslToRgb(color.h, color.s, color.l);
  return rgbaToHex(r, g, b, color.a);
}

/**
 * Strictly parses a supported concrete CSS color string into an HSLa object.
 * Supports: #RGB, #RGBA, #RRGGBB, #RRGGBBAA, rgb(), rgba(), hsl(), hsla().
 * Returns `null` when parsing fails.
 *
 * CSS custom-property references are intentionally not resolved here because
 * their value depends on an element's computed cascade. Use
 * {@link isCssColorValue} when validating editable color text.
 */
export function tryParseCssColor(css: string): MlvHsla | null {
  const str = css.trim().toLowerCase();

  // Handle hex
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    // Expand shorthand #RGB → #RRGGBB
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length === 4) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const rgba = hexToRgba('#' + hex);
    if (rgba) {
      const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);
      return { ...hsl, a: round(rgba.a, 2) };
    }
  }

  // Handle rgb() / rgba()
  const rgbMatch = str.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d+(?:\.\d+)?))?\s*\)$/,
  );
  if (rgbMatch) {
    const r = parseFloat(rgbMatch[1]);
    const g = parseFloat(rgbMatch[2]);
    const b = parseFloat(rgbMatch[3]);
    if ([r, g, b].some((channel) => channel < 0 || channel > 255)) {
      return null;
    }
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    const hsl = rgbToHsl(r, g, b);
    return { ...hsl, a: clamp(a, 0, 1) };
  }

  // Handle hsl() / hsla()
  const hslMatch = str.match(
    /^hsla?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*(?:,\s*(\d+(?:\.\d+)?))?\s*\)$/,
  );
  if (hslMatch) {
    return {
      h: clamp(parseFloat(hslMatch[1]), 0, 360),
      s: clamp(parseFloat(hslMatch[2]), 0, 100),
      l: clamp(parseFloat(hslMatch[3]), 0, 100),
      a: hslMatch[4] !== undefined ? clamp(parseFloat(hslMatch[4]), 0, 1) : 1,
    };
  }

  return null;
}

/**
 * Returns whether a string is a supported concrete color or a syntactically
 * valid CSS custom-property color reference.
 *
 * An unresolved `var(--name)` is valid editable input: the browser resolves it
 * later against the element's computed cascade. Optional fallbacks are
 * validated recursively, including nested `var(...)` references.
 */
export function isCssColorValue(css: string): boolean {
  const value = css.trim();
  return tryParseCssColor(value) !== null || isCssVariableColor(value);
}

/**
 * Parses the grammar needed for color-valued CSS custom-property references
 * without requiring DOM/CSSOM globals, keeping the utility SSR- and test-safe.
 */
function isCssVariableColor(value: string): boolean {
  if (!value.toLowerCase().startsWith('var(') || !value.endsWith(')')) {
    return false;
  }

  const content = value.slice(4, -1);
  let depth = 0;
  let separator = -1;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth < 0) return false;
    } else if (character === ',' && depth === 0 && separator === -1) {
      separator = index;
    }
  }

  if (depth !== 0) return false;

  const customProperty = (
    separator === -1 ? content : content.slice(0, separator)
  ).trim();
  if (!/^--[a-z0-9_-]+$/i.test(customProperty)) return false;

  if (separator === -1) return true;

  const fallback = content.slice(separator + 1).trim();
  return fallback.length > 0 && isCssColorValue(fallback);
}

/**
 * Parses any supported concrete CSS color string into an HSLa object.
 * Returns a default black color if parsing fails.
 */
export function parseCssColor(css: string): MlvHsla {
  return tryParseCssColor(css) ?? { h: 0, s: 0, l: 0, a: 1 };
}

/**
 * Converts an HSLa object to a CSS color string in the specified mode.
 */
export function hslaToModeString(
  color: MlvHsla,
  mode: MlvColorInputMode,
): string {
  if (mode === 'hsl') {
    return hslaToString(color);
  }
  const { r, g, b } = hslToRgb(color.h, color.s, color.l);
  if (mode === 'hex') {
    return rgbaToHex(r, g, b, color.a);
  }
  // rgb
  if (color.a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${round(color.a, 2)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Converts an HSLa color to a CSS rgba() string (used internally for canvas rendering).
 */
export function hslaToRgbaString(color: MlvHsla): string {
  const { r, g, b } = hslToRgb(color.h, color.s, color.l);
  return `rgba(${r}, ${g}, ${b}, ${color.a})`;
}
