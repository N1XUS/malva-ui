import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { MlvButtonVariant } from './button.types';

/**
 * Contract implemented by button containers that provide a default variant to
 * descendant buttons.
 */
export interface MlvButtonVariantAccessor {
  /** The resolved variant descendants should use when they have no override. */
  readonly effectiveVariant: Signal<MlvButtonVariant>;
}

/** Optional ancestor that supplies a default variant to descendant buttons. */
export const MLV_BUTTON_VARIANT = new InjectionToken<MlvButtonVariantAccessor>(
  'MLV_BUTTON_VARIANT',
);
