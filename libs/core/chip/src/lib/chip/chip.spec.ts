import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvChip } from './chip';
import { MlvChipAppend, MlvChipPrepend } from './chip.directives';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

describe('MlvChip', () => {
  let component: MlvChip;
  let fixture: ComponentFixture<MlvChip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvChip],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvChip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

/**
 * Accessibility sweep.
 *
 * A plain chip is a styled `<span>` with a label and no ARIA at all, but
 * `closable` changes the shape twice over: the host becomes a tab stop
 * (`[attr.tabindex]="chipTabIndex()"` plus Backspace/Delete handlers) and a
 * `tabindex="-1"` close `<button>` appears whose only content is an
 * `aria-hidden` glyph, so its whole accessible name comes from the i18n
 * `aria-label` — the case `button-name` exists to catch. The prepend/append
 * slots (`apps/docs/src/app/pages/chip/examples/4`) put arbitrary content
 * beside that label, so they are swept with it.
 */
describe('MlvChip accessibility', () => {
  @Component({
    imports: [MlvChip, MlvChipPrepend, MlvChipAppend],
    template: `
      @for (tone of tones; track tone) {
        <mlv-chip [tone]="tone">{{ tone }}</mlv-chip>
        <mlv-chip [tone]="tone" muted>{{ tone }} muted</mlv-chip>
      }

      <mlv-chip tone="primary" muted closable>Removable</mlv-chip>
      <mlv-chip tone="danger" closable closeAriaLabel="Remove blocker"
        >Blocker</mlv-chip
      >

      <mlv-chip tone="info" muted floating rounded>
        <ng-template mlvChipPrepend>
          <svg aria-hidden="true"></svg>
        </ng-template>
        Label
        <ng-template mlvChipAppend>
          <svg aria-hidden="true"></svg>
        </ng-template>
      </mlv-chip>
    `,
  })
  class ChipA11yHost {
    readonly tones = [
      'default',
      'primary',
      'secondary',
      'accent',
      'success',
      'info',
      'warning',
      'danger',
    ] as const;
  }

  it('has no axe violations across tones, slots and the closable variant', async () => {
    await TestBed.configureTestingModule({
      imports: [ChipA11yHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChipA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: the two closable chips are host tab stops AND each carries a
    // named close button whose glyph is hidden; the non-closable chips take no
    // tabindex at all, so nothing nameless enters the focus order.
    expect(host.querySelectorAll('mlv-chip[tabindex]')).toHaveLength(2);
    const closes = [...host.querySelectorAll('.mlv-chip__close')];
    expect(closes).toHaveLength(2);
    expect(closes.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remove',
      'Remove blocker',
    ]);
    expect(host.querySelectorAll('.mlv-chip__prepend')).toHaveLength(1);
    expect(host.querySelectorAll('.mlv-chip__append')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });
});
