// libs/cdk/testing-e2e/src/kit/states.kit.ts
import { expect, test } from '../fixtures/test';
import type { Locator } from '@playwright/test';
import type {
  MlvComponentManifest,
  MlvExpectedStateEntry,
} from './applicability';

export function registerStatesTests(m: MlvComponentManifest): void {
  const entries = m.expectedStates ?? [];
  if (entries.length === 0) {
    test.skip(`${m.label} — states: no expectedStates entries declared`, () => {
      // no entries — intentionally empty
    });
    return;
  }
  test.describe('states (kit)', () => {
    for (const entry of entries) {
      test(`example ${entry.example} — ${entry.selector}`, async ({ mlv }) => {
        await mlv.goto(m.route);
        await assertStateEntry(mlv.example(entry.example), entry);
      });
    }
  });
}

async function assertStateEntry(
  scope: Locator,
  entry: MlvExpectedStateEntry,
): Promise<void> {
  const target = scope.locator(entry.selector).first();
  await expect(target).toBeVisible();
  for (const cls of entry.classes) {
    await expect(target).toHaveClass(
      new RegExp(`(^|\\s)${escapeRegex(cls)}(\\s|$)`),
    );
  }
  for (const [attr, value] of Object.entries(entry.attributes ?? {})) {
    await expect(target).toHaveAttribute(attr, value);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
