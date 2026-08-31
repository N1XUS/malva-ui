import type { ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvListItemGroup } from './list-item-group';

@Component({
  imports: [MlvListItemGroup],
  template: `<mlv-list-item-group label="Group">Content</mlv-list-item-group>`,
})
class TestListItemGroupHostComponent {}

describe('MlvListItemGroup', () => {
  let fixture: ComponentFixture<TestListItemGroupHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestListItemGroupHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestListItemGroupHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
