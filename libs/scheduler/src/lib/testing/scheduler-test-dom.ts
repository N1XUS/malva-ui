/**
 * Spec-only DOM lookups that fail loudly instead of returning `null`.
 *
 * The scheduler specs query a deeply structured grid, so almost every lookup
 * is "the element I just rendered" rather than "an element that may exist".
 * Writing that as a non-null assertion (`root.querySelector(sel)!`) buys
 * silence from the type checker at the price of a `Cannot read properties of
 * null` five lines further down, with no hint of which selector missed — and
 * `@typescript-eslint/no-non-null-assertion` warns on every one of them.
 *
 * These helpers assert the same thing at runtime and name the selector in the
 * failure, so a spec that stops matching says so where it stopped matching.
 *
 * Never exported from the barrel: `libs/scheduler/src/lib/testing/**` is
 * excluded from `tsconfig.lib.json` and from the `@nx/dependency-checks`
 * scan, so nothing here reaches the published package.
 */

/** `root.querySelector`, failing the spec with the selector when nothing matches. */
export function query<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`No element matches "${selector}".`);
  return element;
}

/** `from.closest`, failing the spec with the selector when no ancestor matches. */
export function closest<T extends Element = HTMLElement>(
  from: Element,
  selector: string,
): T {
  const element = from.closest<T>(selector);
  if (!element) throw new Error(`No ancestor matches "${selector}".`);
  return element;
}

/** The element that owns DOM focus, failing the spec when nothing does. */
export function focused(): HTMLElement {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) {
    throw new Error('Nothing owns DOM focus.');
  }
  return element;
}

/**
 * A value the spec knows is there — the result of a `find()`, an `at(-1)`, a
 * `parentElement`. `what` names it in the failure.
 */
export function present<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${what} to be present.`);
  }
  return value;
}
