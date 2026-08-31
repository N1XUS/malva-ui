import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MlvDivider } from './divider';

describe('MlvDivider', () => {
  @Component({
    template: `<mlv-divider
      [orientation]="orientation()"
      [dashed]="dashed()"
      [muted]="muted()"
      >{{ label() }}</mlv-divider
    >`,
    imports: [MlvDivider],
  })
  class TestHostComponent {
    orientation = signal<'horizontal' | 'vertical'>('horizontal');
    dashed = signal(false);
    muted = signal(false);
    label = signal('');
  }

  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    el = fixture.nativeElement.querySelector('mlv-divider');
  });

  it('should create', () => {
    expect(el).toBeTruthy();
  });

  it('should have role="separator"', () => {
    expect(el.getAttribute('role')).toBe('separator');
  });

  it('should apply horizontal class by default', () => {
    expect(el.classList.contains('mlv-divider--horizontal')).toBe(true);
  });

  it('should apply aria-orientation="horizontal" by default', () => {
    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('should apply vertical class when orientation is vertical', async () => {
    host.orientation.set('vertical');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.classList.contains('mlv-divider--vertical')).toBe(true);
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('should apply dashed class when dashed=true', async () => {
    host.dashed.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.classList.contains('mlv-divider--dashed')).toBe(true);
  });

  it('should apply muted class when muted=true', async () => {
    host.muted.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.classList.contains('mlv-divider--muted')).toBe(true);
  });

  it('should project label content', async () => {
    host.label.set('OR');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.textContent?.trim()).toBe('OR');
  });

  it('should have mlv-divider base class', () => {
    expect(el.classList.contains('mlv-divider')).toBe(true);
  });
});
