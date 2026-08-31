import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvFormControlAppend } from '@malva-ui/core/form-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvInput } from './input';
import {
  MlvPasswordStrength,
  type MlvPasswordStrengthRule,
} from './password-strength';

@Component({
  imports: [MlvInput, MlvPasswordStrength, MlvFormControlAppend],
  template: `
    <mlv-input [mlvPasswordStrength]="rules()" #strength="mlvPasswordStrength">
      <span *mlvFormControlAppend data-score>
        {{ strength.score() }}/{{ strength.maxScore() }}/{{ strength.ratio() }}
      </span>
    </mlv-input>
  `,
})
class HostComponent {
  readonly rules = signal<readonly MlvPasswordStrengthRule[]>([
    (value) => value.length >= 8,
    (value) => /[A-Z]/.test(value),
    (value) => /\d/.test(value),
    (value) => /[^A-Za-z0-9]/.test(value),
  ]);

  readonly input = viewChild.required(MlvInput);
  readonly strength = viewChild.required(MlvPasswordStrength);
}

describe('MlvPasswordStrength', () => {
  it('derives score, maximum, and ratio from the host input value and consumer rules', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();

    fixture.componentInstance.input().value.set('Malva123!');
    fixture.detectChanges();

    expect(fixture.componentInstance.strength().score()).toBe(4);
    expect(fixture.componentInstance.strength().maxScore()).toBe(4);
    expect(fixture.componentInstance.strength().ratio()).toBe(1);
    expect(
      fixture.nativeElement.querySelector('[data-score]').textContent,
    ).toContain('4/4/1');

    fixture.componentInstance.input().value.set('malva');
    fixture.detectChanges();

    expect(fixture.componentInstance.strength().score()).toBe(0);
    expect(fixture.componentInstance.strength().ratio()).toBe(0);
  });

  it('returns a zero ratio when the consumer supplies no rules', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();

    fixture.componentInstance.rules.set([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.strength().score()).toBe(0);
    expect(fixture.componentInstance.strength().maxScore()).toBe(0);
    expect(fixture.componentInstance.strength().ratio()).toBe(0);
  });
});
