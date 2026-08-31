import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
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
