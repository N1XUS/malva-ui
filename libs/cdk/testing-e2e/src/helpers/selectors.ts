// libs/cdk/testing-e2e/src/helpers/selectors.ts
import type { Locator } from '@playwright/test';

/**
 * BEM class selector builder — `.mlv-<block>[__<element>][--<modifier>]`.
 */
export function bem(
  block: string,
  element?: string,
  modifier?: string,
): string {
  let cls = `.mlv-${block}`;
  if (element) cls += `__${element}`;
  if (modifier) cls += `--${modifier}`;
  return cls;
}

/** Scope a BEM selector inside a Locator. */
export function byBem(
  scope: Locator,
  block: string,
  element?: string,
  modifier?: string,
): Locator {
  return scope.locator(bem(block, element, modifier));
}
