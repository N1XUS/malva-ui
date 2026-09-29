// Internal: never re-exported from the entry point's barrel.

import { MLV_EDITOR_COLLABORATION_COLORS } from './collaboration-colors';
import { mlvEditorFnv1a32 } from './collaboration-hash';

/** @private The only colour form that reaches the DOM (y-tiptap's own rule). */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * @internal The palette colour for a peer, from its user id, else its name.
 */
export function mlvEditorCollaborationPaletteColor(key: string): string {
  return MLV_EDITOR_COLLABORATION_COLORS[
    mlvEditorFnv1a32(key) % MLV_EDITOR_COLLABORATION_COLORS.length
  ];
}

/**
 * @internal `color` when it is `#rrggbb`, else the palette colour for `key`.
 * Nothing else ever reaches a style, so peer data cannot inject CSS.
 */
export function sanitizeMlvEditorCollaborationColor(
  color: unknown,
  key: string,
): string {
  return typeof color === 'string' && HEX_COLOR.test(color)
    ? color.toLowerCase()
    : mlvEditorCollaborationPaletteColor(key);
}

/** @private sRGB channel to linear light. */
const linear = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/** @internal WCAG relative luminance of a `#rrggbb` colour. */
export function mlvEditorRelativeLuminance(color: string): number {
  const value = Number.parseInt(color.slice(1), 16);
  return (
    0.2126 * linear((value >> 16) & 0xff) +
    0.7152 * linear((value >> 8) & 0xff) +
    0.0722 * linear(value & 0xff)
  );
}

/**
 * @internal The caret label foreground for a peer colour: black or white,
 * whichever contrasts more. For any sRGB colour the better of the two is at
 * least √21 ≈ 4.58:1, so the label always meets WCAG 1.4.3.
 */
export function mlvEditorCollaborationLabelColor(
  color: string,
): '#000000' | '#ffffff' {
  const luminance = mlvEditorRelativeLuminance(color);
  const withBlack = (luminance + 0.05) / 0.05;
  const withWhite = 1.05 / (luminance + 0.05);
  return withBlack >= withWhite ? '#000000' : '#ffffff';
}

/**
 * @internal The presence avatar background for a peer colour: the colour mixed
 * 75% toward white. `mlv-avatar` paints initials in `neutral-800` (#262626)
 * on any `color`; every channel of the tint is at least 0xbf, so its
 * luminance is at least 0.52 and the initials hold at least 8:1 for any peer
 * colour, palette or consumer-supplied.
 */
export function mlvEditorCollaborationTint(color: string): string {
  const value = Number.parseInt(color.slice(1), 16);
  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * 0.75)
      .toString(16)
      .padStart(2, '0');
  return `#${mix((value >> 16) & 0xff)}${mix((value >> 8) & 0xff)}${mix(value & 0xff)}`;
}
