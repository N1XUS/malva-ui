// libs/cdk/testing-e2e/src/kit/mouse.kit.ts
import { expect, test } from '../fixtures/test';
import {
  countEvents,
  expectEvent,
  expectInspectorValue,
} from '../helpers/inspector';
import type { MlvComponentManifest } from './applicability';

export function registerMouseTests(m: MlvComponentManifest): void {
  const entries = m.expectedMouse ?? [];
  if (entries.length === 0) {
    test.skip(`${m.label} — mouse: no expectedMouse entries declared`, () => {
      // no entries — intentionally empty
    });
    return;
  }
  test.describe('mouse (kit)', () => {
    for (const entry of entries) {
      const title = entry.whenDisabled
        ? `example ${entry.example} — click on disabled trigger is a no-op`
        : `example ${entry.example} — click ${entry.trigger}`;
      test(title, async ({ mlv }) => {
        await mlv.goto(m.route);
        const scope = mlv.example(entry.example);
        const trigger = scope.locator(entry.trigger).first();
        await expect(trigger).toBeVisible();
        if (entry.whenDisabled) {
          const before = entry.expectEvent
            ? await countEvents(scope, entry.expectEvent)
            : 0;
          await trigger.click({ force: true });
          if (entry.expectEvent) {
            const after = await countEvents(scope, entry.expectEvent);
            expect(after).toBe(before);
          }
          return;
        }
        await trigger.click();
        if (entry.expectEvent) {
          await expectEvent(scope, entry.expectEvent);
        }
        if (entry.expectValue !== undefined) {
          await expectInspectorValue(scope, entry.expectValue);
        }
      });
    }
  });
}
