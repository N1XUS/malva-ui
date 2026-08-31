import type { MlvFormGap } from './form.types';

/** @internal Spacing token behind each {@link MlvFormGap} step. */
const GAP_TOKENS: Record<MlvFormGap, string> = {
  xs: 'var(--mlv-spacing-2)',
  s: 'var(--mlv-spacing-3)',
  m: 'var(--mlv-spacing-4)',
  l: 'var(--mlv-spacing-5)',
  xl: 'var(--mlv-spacing-6)',
};

/**
 * @internal Resolves a gap step to the CSS value written into `--mlv-form-gap`.
 */
export function mlvFormGapValue(gap: MlvFormGap): string {
  return GAP_TOKENS[gap];
}
