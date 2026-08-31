import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvButton } from '../button/button';
import { MlvButtonGroup } from './button-group';

@Component({
  imports: [MlvButton, MlvButtonGroup],
  template: `
    <mlv-button-group variant="error" aria-label="Document actions">
      <button mlvButton>Delete</button>
      <button mlvButton variant="outlined">Cancel</button>
    </mlv-button-group>
  `,
})
class ButtonGroupTestHost {}

describe('MlvButtonGroup', () => {
  let fixture: ComponentFixture<ButtonGroupTestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonGroupTestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonGroupTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders an accessible native group', () => {
    const group = fixture.nativeElement.querySelector('mlv-button-group');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Document actions');
  });

  it('provides its variant while preserving a child override', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.mlv-button');
    expect(buttons[0].classList).toContain('mlv-button--variant-error');
    expect(buttons[1].classList).toContain('mlv-button--variant-outlined');
  });
});
