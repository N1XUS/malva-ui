// libs/cdk/testing-e2e/src/helpers/inspector.ts
import { expect, type Locator } from '@playwright/test';

/** Parse the JSON `<docs-inspector>` value inside `scope`. */
export async function readInspectorValue<T = unknown>(
  scope: Locator,
): Promise<T> {
  const raw = await scope.getByTestId('inspector-value').textContent();
  return JSON.parse(raw ?? 'null') as T;
}

/** Polling assertion — waits until the inspector value deep-equals `expected`. */
export async function expectInspectorValue<T>(
  scope: Locator,
  expected: T,
): Promise<void> {
  await expect
    .poll(() => readInspectorValue<T>(scope), { timeout: 5_000 })
    .toEqual(expected);
}

/** Parsed inspector meta object. */
export async function readInspectorMeta<T = Record<string, unknown>>(
  scope: Locator,
): Promise<T> {
  const raw = await scope.getByTestId('inspector-meta').textContent();
  return JSON.parse(raw ?? '{}') as T;
}

/** Polling assertion for a subset of meta keys. */
export async function expectInspectorMeta<T extends Record<string, unknown>>(
  scope: Locator,
  expected: Partial<T>,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const meta = await readInspectorMeta<T>(scope);
        return Object.fromEntries(
          Object.keys(expected).map((k) => [k, meta[k as keyof T]]),
        );
      },
      { timeout: 5_000 },
    )
    .toEqual(expected);
}

/**
 * Assert that an event with the given name has been recorded. When `payload`
 * is provided, the most recent matching event must carry it.
 */
export async function expectEvent(
  scope: Locator,
  name: string,
  payload?: unknown,
): Promise<void> {
  const events = scope.getByTestId('inspector-events');
  const matching = events.locator(`[data-event="${name}"]`);
  await expect(matching.first()).toBeVisible();
  if (payload !== undefined) {
    await expect
      .poll(
        async () => {
          const text = (await matching.last().textContent()) ?? '';
          const jsonStart = text.indexOf(':');
          if (jsonStart === -1) return null;
          return JSON.parse(text.slice(jsonStart + 1).trim());
        },
        { timeout: 5_000 },
      )
      .toEqual(payload);
  }
}

/** Count emitted events with the given name. */
export async function countEvents(
  scope: Locator,
  name: string,
): Promise<number> {
  return scope
    .locator(`[data-testid="inspector-events"] [data-event="${name}"]`)
    .count();
}
