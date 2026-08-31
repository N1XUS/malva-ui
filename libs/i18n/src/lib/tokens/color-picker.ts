import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvColorPickerI18n {
  /** aria-label for the hue slider. */
  hue: string;
  /** aria-label for the opacity slider. */
  opacity: string;
  /** aria-label for the color input mode tab group. */
  colorInputMode: string;
  /** aria-label for the hex color input. */
  hexColorValue: string;
  /** aria-label for the red channel input. */
  redChannel: string;
  /** aria-label for the green channel input. */
  greenChannel: string;
  /** aria-label for the blue channel input. */
  blueChannel: string;
  /** aria-label for the alpha channel input. */
  alphaChannel: string;
  /** aria-label for the HSL hue input. */
  hslHue: string;
  /** aria-label for the HSL saturation input. */
  hslSaturation: string;
  /** aria-label for the HSL lightness input. */
  hslLightness: string;
  /** aria-label for the HSL alpha input. */
  hslAlpha: string;
  /** aria-label for the color picker popup trigger. */
  colorPicker: string;
  /** aria-label for the popup swatch trigger. ICU: "Pick color: {color}". */
  pickColor: string;
}

export const MLV_COLOR_PICKER_I18N = new InjectionToken<
  Signal<MlvColorPickerI18n>
>('MLV_COLOR_PICKER_I18N');

export const MLV_COLOR_PICKER_I18N_CONTEXT: Record<
  keyof MlvColorPickerI18n,
  MlvTranslationContext
> = {
  hue: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'Hue slider control',
  },
  opacity: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'Opacity/transparency slider',
  },
  colorInputMode: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'Tab group to switch between HEX/RGB/HSL input modes',
  },
  hexColorValue: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'Text input for hex color code',
  },
  redChannel: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'RGB red channel numeric input (0-255)',
  },
  greenChannel: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'RGB green channel numeric input (0-255)',
  },
  blueChannel: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'RGB blue channel numeric input (0-255)',
  },
  alphaChannel: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'RGB alpha channel numeric input (0-100)',
  },
  hslHue: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'HSL hue degree input (0-360)',
  },
  hslSaturation: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'HSL saturation percentage input',
  },
  hslLightness: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'HSL lightness percentage input',
  },
  hslAlpha: {
    component: 'mlv-color-picker',
    usage: 'aria-label',
    description: 'HSL alpha channel input (0-100)',
  },
  colorPicker: {
    component: 'mlv-color-picker-popup',
    usage: 'aria-label',
    description: 'Button that opens the color picker popup',
  },
  pickColor: {
    component: 'mlv-color-picker-popup',
    usage: 'aria-label',
    icuParams: ['color'],
    description: 'Swatch trigger announcing the current color value',
  },
};
