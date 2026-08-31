import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import { MlvLabel } from './label';

@Component({
  imports: [MlvLabel],
  template: `<mlv-label [for]="'field-1'" [required]="required()"
    >Email</mlv-label
  >`,
})
class HostComponent {
  readonly required = signal(false);
}

describe('MlvLabel', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('renders the label text against the referenced control', () => {
    const label = fixture.nativeElement.querySelector(
      'label',
    ) as HTMLLabelElement;
    expect(label.getAttribute('for')).toBe('field-1');
    expect(label.textContent?.trim()).toBe('Email');
  });

  it('renders no required marker by default', () => {
    expect(
      fixture.nativeElement.querySelector('.mlv-label__required'),
    ).toBeNull();
  });

  it('renders the asterisk marker plus a visually hidden translated word when required', async () => {
    fixture.componentInstance.required.set(true);
    await fixture.whenStable();

    const marker = fixture.nativeElement.querySelector(
      '.mlv-label__required',
    ) as HTMLElement;
    expect(marker.textContent).toBe('*');
    // The visual marker itself must stay out of the a11y tree; the adjacent
    // visually-hidden node carries the announced word.
    expect(marker.getAttribute('aria-hidden')).toBe('true');
    expect(
      (
        fixture.nativeElement.querySelector(
          '.cdk-visually-hidden',
        ) as HTMLElement
      ).textContent?.trim(),
    ).toBe('required');
  });
});
