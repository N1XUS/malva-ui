import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { MlvLink } from './link';

@Component({
  template: `<a mlvLink href="/test">Test Link</a>`,
  imports: [MlvLink],
})
class TestHostComponent {}

describe('MlvLink', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const link = fixture.nativeElement.querySelector('a[mlvLink], a.mlv-link');
    expect(link).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a')).toBeTruthy();
  });
});
