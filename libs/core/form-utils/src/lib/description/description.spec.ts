import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MlvDescription } from './description';

@Component({
  imports: [MlvDescription],
  template: `<mlv-description id="field-1-description"
    >We only use this for receipts.</mlv-description
  >`,
})
class HostComponent {}

describe('MlvDescription', () => {
  it('renders its projected help text under the block class and keeps its id', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();

    const description = fixture.nativeElement.querySelector(
      'mlv-description',
    ) as HTMLElement;
    expect(description.classList).toContain('mlv-description');
    expect(description.id).toBe('field-1-description');
    expect(description.textContent?.trim()).toBe(
      'We only use this for receipts.',
    );
  });
});
