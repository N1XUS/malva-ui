import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvList } from './list';

describe('MlvList', () => {
  let component: MlvList;
  let fixture: ComponentFixture<MlvList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvList],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits no appearance modifier for the default appearance', () => {
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-list--appearance-menu'),
    ).toBe(false);
  });

  it('adds mlv-list--appearance-menu when appearance="menu"', () => {
    fixture.componentRef.setInput('appearance', 'menu');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-list--appearance-menu'),
    ).toBe(true);
  });
});
