import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvButton } from '../button/button';
import { MlvButtonSplit } from './button-split';

@Component({
  imports: [MlvButton, MlvButtonSplit],
  template: `
    <mlv-button-split variant="accent" aria-label="Save options">
      <button mlvButton>Save</button>
      <button mlvButton aria-label="More save options">More</button>
    </mlv-button-split>
  `,
})
class ButtonSplitTestHost {}

describe('MlvButtonSplit', () => {
  let fixture: ComponentFixture<ButtonSplitTestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonSplitTestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonSplitTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('groups both actions under one accessible name', () => {
    const split = fixture.nativeElement.querySelector('mlv-button-split');
    expect(split.getAttribute('role')).toBe('group');
    expect(split.getAttribute('aria-label')).toBe('Save options');
  });

  it('provides one variant to both actions', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.mlv-button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].classList).toContain('mlv-button--variant-accent');
    expect(buttons[1].classList).toContain('mlv-button--variant-accent');
  });
});

/**
 * Accessibility sweep — `mlv-button-split`.
 *
 * Like `mlv-button-group`, the split's own contribution is `role="group"`, so
 * the sweep is rooted at the fixture root — the element carrying the role —
 * rather than at either projected button. The state worth naming is the second
 * action: it is the icon-only "more" half, named by `aria-label` alone, and the
 * pair only reads correctly if both halves resolve a name inside one group.
 */
describe('MlvButtonSplit accessibility', () => {
  it('has no axe violations for a grouped primary + overflow pair', async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonSplitTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(ButtonSplitTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const split = host.querySelector('mlv-button-split') as HTMLElement;
    expect(split.getAttribute('role')).toBe('group');
    const buttons = [
      ...split.querySelectorAll('button.mlv-button'),
    ] as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons[1].getAttribute('aria-label')).toBe('More save options');

    await expectNoAxeViolations(host);
  });
});
