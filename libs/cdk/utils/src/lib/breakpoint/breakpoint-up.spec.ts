import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvBreakpointUp } from './breakpoint-up';
import { MlvBreakpointService } from './breakpoint.service';
import type { MlvBreakpoint } from './breakpoint.config';

@Component({
  imports: [MlvBreakpointUp],
  template: `<div *mlvBreakpointUp="bp" class="target">visible</div>`,
})
class TestHostComponent {
  bp: MlvBreakpoint = 'md';
}

describe('MlvBreakpointUp', () => {
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

  it('should not render when below breakpoint', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  it('should render when at breakpoint', () => {
    breakpointSignal.set('md');
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();
  });

  it('should render when above breakpoint', () => {
    breakpointSignal.set('lg');
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();
  });

  it('should update when breakpoint changes', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();

    breakpointSignal.set('md');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();

    breakpointSignal.set('sm');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });
});
