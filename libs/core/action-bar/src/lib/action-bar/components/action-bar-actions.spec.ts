import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvActionBarActions } from './action-bar-actions';

@Component({
  imports: [MlvActionBarActions],
  template: '<nav mlvActionBarActions>Projects</nav>',
})
class TestHostComponent {}

describe('MlvActionBarActions', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('applies the action-bar actions class', () => {
    const actions = fixture.nativeElement.querySelector('nav') as HTMLElement;

    expect(actions.classList).toContain('mlv-action-bar__actions');
  });
});
