/** Internal normalized representation of a browser-resolved sRGB color. */
export interface MlvRgbaColor {
  /** Red channel in the inclusive range 0–255. */
  red: number;
  /** Green channel in the inclusive range 0–255. */
  green: number;
  /** Blue channel in the inclusive range 0–255. */
  blue: number;
  /** Alpha channel in the inclusive range 0–1. */
  alpha: number;
}

/** Opaque black, used as one endpoint for automatic contrast. */
const BLACK: MlvRgbaColor = { red: 0, green: 0, blue: 0, alpha: 1 };

/** Opaque white, used as one endpoint for automatic contrast. */
const WHITE: MlvRgbaColor = {
  red: 255,
  green: 255,
  blue: 255,
  alpha: 1,
};

/**
 * Parses an RGB value emitted by the browser CSSOM.
 *
 * @param value Computed `rgb(...)` or `rgba(...)` string.
 * @returns The normalized color, or `null` when the value is not parseable.
 */
export function parseComputedColor(value: string): MlvRgbaColor | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'transparent') {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }

  const match = /^rgba?\((.*)\)$/i.exec(normalized);

  if (!match) {
    return null;
  }

  const body = match[1].trim();
  const commaSeparated = body.includes(',');
  let channelValues: string[];
  let alphaValue: string | undefined;

  if (commaSeparated) {
    const parts = body.split(',').map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) {
      return null;
    }
    channelValues = parts.slice(0, 3);
    alphaValue = parts[3];
  } else {
    const slashParts = body.split('/').map((part) => part.trim());
    if (slashParts.length > 2) {
      return null;
    }
    channelValues = slashParts[0].split(/\s+/);
    alphaValue = slashParts[1];
  }

  if (channelValues.length !== 3) {
    return null;
  }

  const channels = channelValues.map(_parseChannel);
  const alpha = alphaValue === undefined ? 1 : _parseAlpha(alphaValue);

  if (channels.some((channel) => channel === null) || alpha === null) {
    return null;
  }

  return {
    red: channels[0] as number,
    green: channels[1] as number,
    blue: channels[2] as number,
    alpha,
  };
}

/**
 * Composites one sRGB color over another using source-over alpha blending.
 *
 * @param foreground Color painted above the background.
 * @param background Color painted below the foreground.
 * @returns The effective blended color.
 */
export function compositeColors(
  foreground: MlvRgbaColor,
  background: MlvRgbaColor,
): MlvRgbaColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);

  if (alpha === 0) {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }

  return {
    red: _compositeChannel(
      foreground.red,
      background.red,
      foreground.alpha,
      background.alpha,
      alpha,
    ),
    green: _compositeChannel(
      foreground.green,
      background.green,
      foreground.alpha,
      background.alpha,
      alpha,
    ),
    blue: _compositeChannel(
      foreground.blue,
      background.blue,
      foreground.alpha,
      background.alpha,
      alpha,
    ),
    alpha,
  };
}

/**
 * Serializes a normalized color to modern CSS RGB syntax.
 *
 * @param color Color to serialize.
 * @returns A CSS `rgb(...)` value.
 */
export function toCssColor(color: MlvRgbaColor): string {
  const channels = [color.red, color.green, color.blue]
    .map(_formatNumber)
    .join(', ');
  if (color.alpha >= 1) {
    return `rgb(${channels})`;
  }
  return `rgba(${channels}, ${_formatNumber(color.alpha)})`;
}

/**
 * Computes the WCAG contrast ratio between two opaque effective colors.
 *
 * @param first First effective color.
 * @param second Second effective color.
 * @returns Contrast ratio in the inclusive range 1–21.
 */
export function contrastRatio(
  first: MlvRgbaColor,
  second: MlvRgbaColor,
): number {
  const firstLuminance = _relativeLuminance(first);
  const secondLuminance = _relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Selects the black or white endpoint with the strongest WCAG contrast.
 *
 * @param background Opaque effective background color.
 * @returns An opaque CSS black or white value.
 */
export function chooseContrastForeground(background: MlvRgbaColor): string {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE)
    ? 'rgb(0, 0, 0)'
    : 'rgb(255, 255, 255)';
}

/**
 * Parses an RGB channel expressed as a number or percentage.
 *
 * @param value Serialized channel.
 * @returns A channel in the range 0–255, or `null` when invalid.
 */
function _parseChannel(value: string): number | null {
  const isPercentage = value.endsWith('%');
  const parsed = Number(isPercentage ? value.slice(0, -1) : value);
  const channel = isPercentage ? (parsed / 100) * 255 : parsed;
  return Number.isFinite(channel) && channel >= 0 && channel <= 255
    ? channel
    : null;
}

/**
 * Parses an alpha channel expressed as a number or percentage.
 *
 * @param value Serialized alpha channel.
 * @returns A channel in the range 0–1, or `null` when invalid.
 */
function _parseAlpha(value: string): number | null {
  const isPercentage = value.endsWith('%');
  const parsed = Number(isPercentage ? value.slice(0, -1) : value);
  const alpha = isPercentage ? parsed / 100 : parsed;
  return Number.isFinite(alpha) && alpha >= 0 && alpha <= 1 ? alpha : null;
}

/**
 * Blends one channel using source-over alpha compositing.
 *
 * @param foreground Foreground channel.
 * @param background Background channel.
 * @param foregroundAlpha Foreground alpha.
 * @param backgroundAlpha Background alpha.
 * @param outputAlpha Resulting alpha.
 * @returns Blended channel.
 */
function _compositeChannel(
  foreground: number,
  background: number,
  foregroundAlpha: number,
  backgroundAlpha: number,
  outputAlpha: number,
): number {
  return (
    (foreground * foregroundAlpha +
      background * backgroundAlpha * (1 - foregroundAlpha)) /
    outputAlpha
  );
}

/**
 * Computes WCAG relative luminance for an sRGB color.
 *
 * @param color Effective color.
 * @returns Relative luminance in the range 0–1.
 */
function _relativeLuminance(color: MlvRgbaColor): number {
  const red = _linearizeChannel(color.red);
  const green = _linearizeChannel(color.green);
  const blue = _linearizeChannel(color.blue);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * Converts an sRGB channel to linear light for luminance calculation.
 *
 * @param channel Channel in the range 0–255.
 * @returns Linearized channel in the range 0–1.
 */
function _linearizeChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

/**
 * Produces a compact, stable decimal for CSS serialization.
 *
 * @param value Numeric value.
 * @returns Rounded decimal without trailing zeroes.
 */
function _formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
