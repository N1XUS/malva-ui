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

  it('keeps the inner panel as the one dialog while anchored', async () => {
    const { body, open } = await render();
    breakpoint.down.set(false);
    await open();

    // Anchored, the popup panel is a role-less positioning shell and the inner
    // `__panel` is the dialog.
    const inner = body.querySelector(
      '.mlv-date-range-picker__panel',
    ) as HTMLElement;
    expect(inner.getAttribute('role')).toBe('dialog');
    expect(inner.getAttribute('aria-modal')).toBe('true');
    expect(inner.getAttribute('aria-label')).toBe('Select date range');
    expect(body.querySelectorAll('[role="dialog"]').length).toBe(1);
  });

  it('has no axe violations with the full-screen sheet open', async () => {
    const { body, open } = await render();
    breakpoint.down.set(true);
    await open();

    expect(body.querySelectorAll('mlv-calendar-sheet').length).toBe(1);
    await expectNoAxeViolations(body);
  });

  it('opens the full-screen sheet as the one modal dialog, named by its title', async () => {
    const { body, open } = await render();
    breakpoint.down.set(true);
    await open();

    // #322: the sheet is a modal dialog named by its visible title.
    const sheet = body.querySelector('.mlv-popup--fullscreen') as HTMLElement;
    const title = sheet.querySelector('.mlv-popup__title') as HTMLElement;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(title.id).not.toBe('');
    expect(sheet.getAttribute('aria-labelledby')).toBe(title.id);
    expect(title.textContent?.trim()).toBe('Stay dates');
    expect(sheet.hasAttribute('aria-label')).toBe(false);
    // The sheet is the one dialog. The inner `__panel` steps down while it is
    // full-screen — the same way it drops its own focus trap there — so AT
    // does not meet a modal dialog nested in a modal dialog, whose inner
    // `aria-modal` would also wall off the sheet's title, close and Done.
    const inner = sheet.querySelector(
      '.mlv-date-range-picker__panel',
    ) as HTMLElement;
    expect(inner.hasAttribute('role')).toBe(false);
    expect(inner.hasAttribute('aria-modal')).toBe(false);
    expect(inner.hasAttribute('aria-label')).toBe(false);
    expect(body.querySelectorAll('[role="dialog"]').length).toBe(1);
  });
});
