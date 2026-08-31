import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MlvFormControlWrapperControl } from './form-control-wrapper-control';

@Component({
  imports: [MlvFormControlWrapperControl],
  template: `<ng-template mlvFormControlWrapperControl></ng-template>`,
})
class HostComponent {
  readonly directive = viewChild.required(MlvFormControlWrapperControl);
}

describe('MlvFormControlWrapperControl', () => {
  it('should create an instance', () => {
    // Instantiating the directive directly with `new` bypasses Angular's
    // injection context, so its `inject(TemplateRef)` field initializer
    // throws (NG0203). Rendering it on a real `<ng-template>` gives it a
    // proper injection context, matching how the directive is used in practice.
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.directive()).toBeTruthy();
  });
});
