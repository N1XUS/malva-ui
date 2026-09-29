import { InjectionToken, type Provider } from '@angular/core';

/** One entry of the font-family menu. */
export interface MlvEditorFontFamilyOption {
  /** Menu label, and the text the trigger shows while this family applies. */
  readonly label: string;
  /**
   * CSS `font-family` value written to the text, e.g.
   * `"ui-serif, Georgia, serif"`. Matched against the stored value family by
   * family, ignoring quotes, surrounding spaces and case, because a browser
   * re-quotes the stack it serializes.
   */
  readonly value: string;
}

/**
 * Option lists of the font-family, font-size and line-height toolbar menus.
 * Provide with {@link provideMlvEditorTextStyles}.
 */
export interface MlvEditorTextStyleOptions {
  /**
   * Font families offered, in menu order. `null` uses the built-in localized
   * list: sans serif, serif and monospace system stacks.
   */
  readonly fontFamilies: readonly MlvEditorFontFamilyOption[] | null;
  /** CSS font sizes offered, in menu order, e.g. `'16px'`. */
  readonly fontSizes: readonly string[];
  /** Unitless block line heights offered, in menu order, e.g. `'1.5'`. */
  readonly lineHeights: readonly string[];
}

/** @private Default option lists used when nothing is provided. */
const DEFAULT_TEXT_STYLES: MlvEditorTextStyleOptions = {
  fontFamilies: null,
  fontSizes: ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px'],
  lineHeights: ['1', '1.15', '1.5', '2'],
};

/**
 * Option lists of the editor's font-family, font-size and line-height menus.
 * The root default offers the built-in font families, sizes 12–36px and
 * line heights 1, 1.15, 1.5 and 2.
 */
export const MLV_EDITOR_TEXT_STYLES =
  new InjectionToken<MlvEditorTextStyleOptions>('MLV_EDITOR_TEXT_STYLES', {
    providedIn: 'root',
    factory: () => DEFAULT_TEXT_STYLES,
  });

/**
 * Provides the option lists of the editor's text-style menus. Omitted fields
 * keep their defaults.
 *
 * @example
 * providers: [provideMlvEditorTextStyles({ fontSizes: ['14px', '16px', '20px'] })]
 *
 * @param options The lists to replace.
 * @returns A provider for an application's or a component's `providers`.
 */
export function provideMlvEditorTextStyles(
  options: Partial<MlvEditorTextStyleOptions>,
): Provider {
  return {
    provide: MLV_EDITOR_TEXT_STYLES,
    useValue: { ...DEFAULT_TEXT_STYLES, ...options },
  };
}
