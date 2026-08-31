import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvAnimatedPresence } from './animated-presence';

@Component({
  imports: [MlvAnimatedPresence],
  template: `<div *mlvAnimatedPresence="show()" class="target">content</div>`,
})
class TestHostComponent {
  show = signal(false);
}

@Component({
  imports: [MlvAnimatedPresence],
  template: `
    <div
      *mlvAnimatedPresence="
        show();
        enterClass: 'custom-enter';
        leaveClass: 'custom-leave'
      "
      class="target"
    >
      content
    </div>
  `,
})
class CustomClassHostComponent {
  show = signal(false);
}

describe('MlvAnimatedPresence', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, CustomClassHostComponent],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render when condition is false', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  it('should render when condition is true', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();
  });

  it('should add enter class when mounting', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.target.mlv-presence--enter'),
    ).toBeTruthy();
  });

  it('should add leave class when unmounting before rAF fires', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    fixture.componentInstance.show.set(false);
    fixture.detectChanges();

    // Before rAF fires, element is still present with leave class
    const el = fixture.nativeElement.querySelector('.target');
    expect(el).toBeTruthy();
    expect(el.classList.contains('mlv-presence--leave')).toBeTruthy();
  });

  it('should remove element after rAF fires (no animation in jsdom)', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    fixture.componentInstance.show.set(false);
    fixture.detectChanges();

    // Run the requestAnimationFrame callback
    vi.runAllTimers();

    // In jsdom, getComputedStyle returns animationName 'none', so element is destroyed immediately
    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  it('should cancel leave when re-entering before rAF fires', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    // Begin leave
    fixture.componentInstance.show.set(false);
    fixture.detectChanges();

    // Re-enter before rAF fires (leavePending = true, rAF pending)
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    vi.runAllTimers();

    // View should still be present
    expect(fixture.nativeElement.querySelector('.target')).toBeTruthy();
  });

  it('should use custom enter class', () => {
    const fixture = TestBed.createComponent(CustomClassHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.target.custom-enter'),
    ).toBeTruthy();
  });

  it('should remove element with custom leave class after rAF fires', () => {
    const fixture = TestBed.createComponent(CustomClassHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();

    fixture.componentInstance.show.set(false);
    fixture.detectChanges();
    vi.runAllTimers();

    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });

  it('should mount only once when condition stays true', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    fixture.detectChanges();

    const targets = fixture.nativeElement.querySelectorAll('.target');
    expect(targets.length).toBe(1);
  });

  it('should not render when toggled off after rAF', () => {
    const fixture = TestBed.createComponent(TestHostComponent);

    // Mount
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    vi.runAllTimers();

    // Unmount
    fixture.componentInstance.show.set(false);
    fixture.detectChanges();
    vi.runAllTimers();

    expect(fixture.nativeElement.querySelector('.target')).toBeNull();
  });
});
