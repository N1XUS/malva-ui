import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvBreakpointService, type MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvTimePicker } from './time-picker';

@Component({
  imports: [MlvTimePicker],
  template: `<mlv-time-picker
    label="Meeting time"
    [mode]="mode()"
    [showSeconds]="showSeconds()"
    [value]="value()"
  />`,
})
class A11yHost {
  readonly mode = signal<'24h' | '12h'>('24h');
  readonly showSeconds = signal(false);
  readonly value = signal('');
}

/**
 * Stubs the breakpoint service so the suite chooses its layout rather than
 * inheriting one. jsdom's `matchMedia` never matches a `min-width` query, so
 * the real service is pinned to `'sm'` and every open would be the full-screen
 * sheet — the anchored panel would go unswept while looking covered.
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
 * The closed trigger is a fraction of this component: the drum columns —
 * `mlv-scrubber`'s `@angular/aria` listbox in activedescendant mode, plus the
 * 12h AM/PM button pair — only exist while the popup is open, and the popup is
 * portaled into the CDK overlay container, outside `fixture.nativeElement`.
 * `.claude/rules/accessibility.md` asks for one sweep per state that changes
 * the markup, over `document.body` for overlay content — which is what earns
 * `core-time-picker`'s removal from `ROLLOUT_PENDING` in
 * `scripts/check-axe-coverage.mjs`.
 */
describe('MlvTimePicker accessibility', () => {
  let breakpoint: FakeBreakpointService;

  async function render(): Promise<{
    body: HTMLElement;
    host: A11yHost;
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
      host: fixture.componentInstance,
      open: async () => {
        const trigger = fixture.nativeElement.querySelector(
          '.mlv-time-picker__trigger',
        ) as HTMLElement;
        trigger.click();
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

  it('has no axe violations with the anchored 24h panel open', async () => {
    const { body, open } = await render();
    breakpoint.down.set(false);
    await open();

    // Hours + minutes, no AM/PM, no seconds.
    expect(body.querySelectorAll('[role="listbox"]').length).toBe(2);
    await expectNoAxeViolations(body);
  });

  it('has no axe violations with the 12h AM/PM pair and seconds column open', async () => {
    const { body, host, open } = await render();
    host.mode.set('12h');
    host.showSeconds.set(true);
    breakpoint.down.set(false);
    await open();

    // Hours + minutes + seconds; AM/PM is a button pair, not a drum.
    expect(body.querySelectorAll('[role="listbox"]').length).toBe(3);
    await expectNoAxeViolations(body);
  });

  // The sweeps above run on an empty value, which since #348 renders the
  // trigger placeholder and drums with no selection. A held value is a
  // different markup — selected options, a pressed period — so it is swept
  // on its own.
  it('has no axe violations with a value held, panel open', async () => {
    const { body, host, open } = await render();
    host.value.set('21:45:30');
    host.mode.set('12h');
    host.showSeconds.set(true);
    breakpoint.down.set(false);
    await open();

    expect(
      body.querySelectorAll('[role="option"][aria-selected="true"]').length,
    ).toBe(3);
    expect(
      body.querySelectorAll('.mlv-time-picker__ampm [aria-pressed="true"]')
        .length,
    ).toBe(1);
    await expectNoAxeViolations(body);
  });

  it('has no axe violations in the full-screen sheet', async () => {
    const { body, open } = await render();
    breakpoint.down.set(true);
    await open();

    expect(body.querySelectorAll('[role="listbox"]').length).toBe(2);
    await expectNoAxeViolations(body);
  });

  it('opens the full-screen sheet as a modal dialog named by its title', async () => {
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
    expect(title.textContent?.trim()).toBe('Meeting time');
    expect(sheet.hasAttribute('aria-label')).toBe(false);
  });
});
