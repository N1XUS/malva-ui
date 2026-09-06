import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { createSchedulerTestContext } from './scheduler-test-context';

describe('createSchedulerTestContext', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  it('repairs hiddenDays through hiddenWeekdays, like the real root', () => {
    // The fake context has to agree with `MlvScheduler.rowLength`, or a spec
    // driven by it lays rows out against a width the shipped component never
    // renders. An all-seven set hides nothing (the grid renders the week
    // rather than an empty page) and out-of-range indices hide nothing either.
    expect(
      createSchedulerTestContext({
        hiddenDays: [0, 1, 2, 3, 4, 5, 6],
      }).context.rowLength(),
    ).toBe(7);
    expect(
      createSchedulerTestContext({
        hiddenDays: [7, -1, 1.5],
      }).context.rowLength(),
    ).toBe(7);
    expect(
      createSchedulerTestContext({ hiddenDays: [0, 6, 6] }).context.rowLength(),
    ).toBe(5);
  });
});
