import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

/**
 * Converts a string to an HSL CSS color by hashing the string characters into a hue (0–360).
 *
 * Hue is the only thing the name controls. Saturation stays near 60% and lightness
 * near 80% so every derived color is a **pale tint** that carries dark text at AA
 * — per AB-R6 of the 2026-08 visual language spec, a name-derived avatar is a quiet
 * identity marker, not an accent-carrying mark competing for the view's accent budget.
 * `mlv-avatar` paints a tinted avatar's initials in the opaque
 * `--mlv-palette-neutral-800`, which clears 4.5:1 on every colour this pipe can
 * emit (worst case 6.2:1, measured over the whole band). Callers that want no
 * identity hue at all simply omit `[color]`; `mlv-avatar` then renders the
 * theme's neutral surface and text pair.
 *
 * @example
 * {{ 'John Doe' | mlvColorFromText }}  // 'hsl(147,58%,78%)'
 * {{ 'Alice' | mlvColorFromText }}     // 'hsl(88,63%,83%)'
 */
@Pipe({ name: 'mlvColorFromText' })
export class MlvColorFromTextPipe implements PipeTransform {
  /**
   * Transforms a string into a deterministic HSL color value.
   *
   * @param value - The string to convert. Returns a default color for empty strings.
   * @returns A CSS `hsl(...)` string.
   */
  transform(value: string | null | undefined): string {
    if (!value) {
      // Same pale band as every hashed value below. The AB-R6 retune moved the
      // hashed lightness 45% -> ~80% but left this literal at 45%, so a nameless
      // avatar rendered a mid-dark fill under the dark
      // `--mlv-palette-neutral-800` initials (~3.0:1, under AA). Keeping the
      // fallback inside the band restores ~8.7:1 and makes the format uniform.
      return 'hsl(210,60%,80%)';
    }
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0; // Convert to 32-bit integer
    }
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (hash % 5);
    const lightness = 80 + (hash % 5);
    return `hsl(${hue},${saturation}%,${lightness}%)`;
  }
}
