import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvActionBar } from './action-bar';

describe('MlvActionBar', () => {
  let component: MlvActionBar;
  let fixture: ComponentFixture<MlvActionBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvActionBar],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvActionBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('wrap', () => {
    it('keeps the single-row geometry by default', () => {
      expect(component.wrap()).toBe(false);
      expect(fixture.nativeElement.classList).not.toContain(
        'mlv-action-bar--wrap',
      );
    });

    it('applies the wrap modifier when enabled', async () => {
      fixture.componentRef.setInput('wrap', true);
      await fixture.whenStable();

      expect(component.wrap()).toBe(true);
      expect(fixture.nativeElement.classList).toContain('mlv-action-bar--wrap');
    });

    it('coerces the bare attribute form to true', async () => {
      fixture.componentRef.setInput('wrap', '');
      await fixture.whenStable();

      expect(component.wrap()).toBe(true);
      expect(fixture.nativeElement.classList).toContain('mlv-action-bar--wrap');
    });
  });
});
