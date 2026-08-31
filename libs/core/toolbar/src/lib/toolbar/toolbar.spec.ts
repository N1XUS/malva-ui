import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MlvToolbar } from './toolbar';
import { MlvToolbarSpacer } from './toolbar-spacer';

@Component({
  imports: [MlvToolbar, MlvToolbarSpacer],
  template: `
    <mlv-toolbar [gap]="gap()" [equalSize]="equalSize()">
      <button>Left</button>
      <mlv-toolbar-spacer />
      <button>Right</button>
    </mlv-toolbar>
  `,
})
class ToolbarTestHostComponent {
  gap = signal(0.25);
  equalSize = signal(false);
}

describe('MlvToolbar', () => {
  let fixture: ComponentFixture<ToolbarTestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarTestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolbarTestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    const toolbar = fixture.nativeElement.querySelector('.mlv-toolbar');
    expect(toolbar).toBeTruthy();
  });

  it('should apply default gap', () => {
    const toolbar = fixture.nativeElement.querySelector(
      '.mlv-toolbar',
    ) as HTMLElement;
    expect(toolbar.style.gap).toBe('0.25rem');
  });

  it('should apply custom gap', async () => {
    fixture.componentInstance.gap.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    const toolbar = fixture.nativeElement.querySelector(
      '.mlv-toolbar',
    ) as HTMLElement;
    expect(toolbar.style.gap).toBe('1rem');
  });

  it('should apply equal size class', async () => {
    fixture.componentInstance.equalSize.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const toolbar = fixture.nativeElement.querySelector('.mlv-toolbar');
    expect(toolbar.classList.contains('mlv-toolbar--equal')).toBe(true);
  });

  it('should render spacer', () => {
    const spacer = fixture.nativeElement.querySelector('.mlv-toolbar-spacer');
    expect(spacer).toBeTruthy();
  });
});
