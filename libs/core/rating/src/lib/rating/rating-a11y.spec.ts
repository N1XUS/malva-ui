import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import type { Type } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvRating } from './rating';

// ---------------------------------------------------------------------------
// Axe sweeps — one per state that changes the rendered markup: unrated, a
// value committed with the keyboard (focus on the star holding the stop, #314),
// a half value, readonly, disabled, a validation state, and a scoped RTL
// subtree. Nothing here is portaled, so the fixture element is the whole
// surface.
// ---------------------------------------------------------------------------

@Component({
  template: `<mlv-rating [max]="5" />`,
  imports: [MlvRating],
})
class UnratedHost {}

@Component({
  template: `<mlv-rating [max]="5" [formControl]="ctrl" />`,
  imports: [MlvRating, ReactiveFormsModule],
})
class WholeHost {
  readonly ctrl = new FormControl<number>(2);
}

@Component({
  template: `<mlv-rating [max]="5" [step]="0.5" [formControl]="ctrl" />`,
  imports: [MlvRating, ReactiveFormsModule],
})
class HalfHost {
  readonly ctrl = new FormControl<number>(2);
}

@Component({
  template: `<mlv-rating [max]="5" [value]="3.5" [readonly]="true" />`,
  imports: [MlvRating],
})
class ReadonlyHost {}

@Component({
  template: `<mlv-rating [max]="5" [value]="3" [disabled]="true" />`,
  imports: [MlvRating],
})
class DisabledHost {}

@Component({
  template: `<mlv-rating [max]="5" [value]="1" state="error" />`,
  imports: [MlvRating],
})
class ErrorHost {}

@Component({
  template: `<div dir="rtl">
    <mlv-rating [max]="5" [value]="2.5" [step]="0.5" />
  </div>`,
  imports: [MlvRating],
})
class ScopedRtlHost {}

async function render(
  hostClass: Type<unknown>,
): Promise<ComponentFixture<unknown>> {
  await TestBed.configureTestingModule({
    imports: [hostClass],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(hostClass);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

/**
 * Tabs onto the star holding the roving stop and presses `key` there, then
 * waits for the view — the state a keyboard user leaves the rating in.
 */
async function pressFromTabStop(
  fixture: ComponentFixture<unknown>,
  key: string,
): Promise<void> {
  const root = fixture.nativeElement as HTMLElement;
  (
    root.querySelector('.mlv-rating__star[tabindex="0"]') as HTMLElement
  ).focus();
  (document.activeElement as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('MlvRating a11y', () => {
  it.each([
    ['unrated', UnratedHost],
    ['readonly with a half value', ReadonlyHost],
    ['disabled', DisabledHost],
    ['error state', ErrorHost],
    ['scoped [dir="rtl"] with a half value', ScopedRtlHost],
  ] as const)('has no axe violations: %s', async (_state, hostClass) => {
    const fixture = await render(hostClass);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations after a keyboard change moves focus and fill', async () => {
    const fixture = await render(WholeHost);
    await pressFromTabStop(fixture, 'ArrowRight');

    expect(
      (document.activeElement as HTMLElement).getAttribute('aria-label'),
    ).toBe('Rate 3 out of 5');
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations after a keyboard change lands on a half value', async () => {
    const fixture = await render(HalfHost);
    await pressFromTabStop(fixture, 'ArrowRight');

    expect(
      (document.activeElement as HTMLElement).getAttribute('aria-label'),
    ).toBe('Rate 3 out of 5');
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
