import type { AxeResults, Result, RunOptions } from 'axe-core';

export declare const AXE_JSDOM_DISABLED_RULES: Readonly<
  Record<string, { enabled: false }>
>;

export declare function formatAxeViolations(
  violations: readonly Result[],
): string;

export declare function runAxe(
  root: Element | Document,
  options?: RunOptions,
): Promise<AxeResults>;

export declare function expectNoAxeViolations(
  root: Element | Document,
  options?: RunOptions,
): Promise<void>;
