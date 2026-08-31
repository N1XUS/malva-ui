import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvBreakpointDown } from './breakpoint-down';
import { MlvBreakpointService } from './breakpoint.service';
import type { MlvBreakpoint } from './breakpoint.config';

@Component({
  imports: [MlvBreakpointDown],
  template: `<div *mlvBreakpointDown="bp" class="target">visible</div>`,
})
class TestHostComponent {
  bp: MlvBreakpoint = 'md';
}

describe('MlvBreakpointDown', () => {
  const breakpointSignal = signal<MlvBreakpoint>('sm');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        {
          provide: MlvBreakpointService,
          useValue: { breakpoint: breakpointSignal },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => breakpointSignal.set('sm'));

  it('should render when below breakpoint', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();
  });

  it('should not render when at breakpoint', () => {
    breakpointSignal.set('md');
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  it('should not render when above breakpoint', () => {
    breakpointSignal.set('lg');
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  it('should update when breakpoint changes', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();

    breakpointSignal.set('md');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();

    breakpointSignal.set('sm');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();
  });
});
