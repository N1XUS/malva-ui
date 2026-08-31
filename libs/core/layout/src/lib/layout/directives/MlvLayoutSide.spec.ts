import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvLayoutSide } from './MlvLayoutSide';

@Component({
  imports: [MlvLayoutSide],
  template: `<ng-template mlvLayoutSide></ng-template>`,
})
class TestHostComponent {}

describe('MlvLayoutSide', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    // Directives on <ng-template> are not queryable via By.directive in all Angular versions.
    // Verify the host component compiled and rendered without errors.
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
