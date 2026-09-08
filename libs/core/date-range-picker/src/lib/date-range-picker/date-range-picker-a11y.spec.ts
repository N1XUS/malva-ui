import {
  Component,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvBreakpointService, type MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvDateRangePicker } from './date-range-picker';

@Component({
  imports: [MlvDateRangePicker],
  template: `<mlv-date-range-picker label="Stay dates" />`,
})
class A11yHost {
  readonly picker = viewChild.required(MlvDateRangePicker);
}

/**
 * Stubs the breakpoint service so the suite chooses its layout rather than
 * inheriting one. jsdom's `matchMedia` never matches a `min-width` query, so
 * the real service is pinned to `'sm'` and every open would be the full-screen
 * sheet — the two-panel calendar would go unswept while looking covered.
 */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(false);
  }
}

/**
 * The closed trigger is a fraction of this component: the two side-by-side
 * calendar panels and the full-screen `mlv-calendar-sheet` only exist while the
 * popup is open, and the popup is portaled into the CDK overlay container,
 * outside `fixture.nativeElement`. `.claude/rules/accessibility.md` asks for
 * one sweep per state that changes the markup, over `document.body` for
 * overlay content — which is what earns `core-date-range-picker`'s removal from
 * `ROLLOUT_PENDING` in `scripts/check-axe-coverage.mjs`.
 */
describe('MlvDateRangePicker accessibility', () => {
  let breakpoint: FakeBreakpointService;

  async function render(): Promise<{
    body: HTMLElement;
    open: () => Promise<void>;
  }> {
    await TestBed.configureTestingModule({
      imports: [A11yHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();
    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;

    const fixture = TestBed.createComponent(A11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return {
      body: document.body,
      open: async () => {
        fixture.componentInstance.picker().toggleDropdown();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      },
    };
  }

  it('has no axe violations while closed', async () => {
    const { body } = await render();

    await expectNoAxeViolations(body);
  });

  it('has no axe violations with the two anchored panels open', async () => {
    const { body, open } = await render();
    breakpoint.down.set(false);
    await open();

    expect(body.querySelectorAll('mlv-calendar').length).toBe(2);
    await expectNoAxeViolations(body);
  });

  it('has no axe violations with the full-screen sheet open', async () => {
    const { body, open } = await render();
    breakpoint.down.set(true);
    await open();

    expect(body.querySelectorAll('mlv-calendar-sheet').length).toBe(1);
    await expectNoAxeViolations(body);
  });
});
