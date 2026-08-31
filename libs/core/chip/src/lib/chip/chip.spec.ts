import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvChip } from './chip';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

describe('MlvChip', () => {
  let component: MlvChip;
  let fixture: ComponentFixture<MlvChip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvChip],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvChip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
