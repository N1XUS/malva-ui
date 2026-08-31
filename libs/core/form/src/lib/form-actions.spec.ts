import {
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvFormActions } from './form-actions';
import { MlvFormHeader } from './form-header';
import type { MlvFormActionsAlign } from './form.types';

@Component({
  imports: [MlvFormActions, MlvFormHeader],
  template: `
    <header mlvFormHeader><h3>Title</h3></header>
    <footer mlvFormActions [align]="align()">
      <button type="button">Ok</button>
    </footer>
  `,
})
class Host {
  readonly align = signal<MlvFormActionsAlign>('start');
}

describe('MlvFormHeader / MlvFormActions', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('marks the header element', () => {
    const header = fixture.nativeElement.querySelector('header') as HTMLElement;
    expect(header.classList).toContain('mlv-form__header');
  });

  it('marks the actions row with no align modifier by default', () => {
    const footer = fixture.nativeElement.querySelector('footer') as HTMLElement;
    expect(footer.classList).toContain('mlv-form__actions');
    expect(footer.className).not.toMatch(/mlv-form__actions--align-/);
  });

  it.each([
    ['end', 'mlv-form__actions--align-end'],
    ['center', 'mlv-form__actions--align-center'],
    ['between', 'mlv-form__actions--align-between'],
  ] as const)('applies the %s modifier', async (align, cls) => {
    fixture.componentInstance.align.set(align);
    fixture.detectChanges();
    await fixture.whenStable();
    const footer = fixture.nativeElement.querySelector('footer') as HTMLElement;
    expect(footer.classList).toContain(cls);
  });
});
