import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MlvPopup } from '@malva-ui/core/popup';
import { MlvDayPicker } from './day-picker';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

@Component({
  template: `<mlv-day-picker />`,
  imports: [MlvDayPicker],
})
class TestHostComponent {}

describe('MlvDayPicker', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const el = fixture.nativeElement.querySelector('mlv-day-picker');
    expect(el).toBeTruthy();
  });

  it('opts the calendar popup into auto mobile fullscreen mode', () => {
    fixture.detectChanges();
    const popup = fixture.debugElement.query(By.directive(MlvPopup))
      .componentInstance as MlvPopup;
    expect(popup.mobileMode()).toBe('auto');
  });
});
