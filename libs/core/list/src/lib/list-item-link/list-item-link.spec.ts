import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvListItemLink } from './list-item-link';

describe('MlvListItemLink', () => {
  let component: MlvListItemLink;
  let fixture: ComponentFixture<MlvListItemLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvListItemLink],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvListItemLink);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
