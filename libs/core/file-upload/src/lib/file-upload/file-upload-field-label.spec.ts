import type { ModelSignal, Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  model,
  ViewEncapsulation,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { MlvFormControlLabelStrategy } from '@malva-ui/core/form-utils';
import {
  MLV_FORM_CONTROL,
  MlvFormField,
  MlvLabel,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';

import { MlvFileUpload } from './file-upload';

/**
 * Stand-in for the labelable half of the control family (`mlv-input`,
 * `mlv-textarea`, `mlv-number-input`, …): the control's `id` lands on a native
 * `<input>`, so a `<label for>` names it.
 *
 * A stub rather than the real `mlv-input` so `core-file-upload` gains no
 * dependency on `core-input`; the mechanism under test is which node
 * `mlv-form-field` resolves through `MLV_FORM_CONTROL`, which is
 * strategy-driven and identical for either.
 *
 * Carries the `mlv` prefix because several projects carry their own eslint
 * config applying `@angular-eslint/component-selector` to every `*.ts` file,
 * spec files included.
 */
@Component({
  selector: 'mlv-test-native-control',
  template: `<input [id]="id()" [value]="value()" />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => TestNativeControl),
    },
  ],
})
class TestNativeControl extends MlvSignalFormControlBase<string> {
  readonly value: ModelSignal<string> = model('');
  readonly hasValue: Signal<boolean> = computed(() => this.value() !== '');
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'native';
  }
}

/**
 * `mlv-file-upload` has no nested control to be confused with, so the shape
 * that exposes its missing provider is the ticket's second one: a field
 * holding the upload zone **and** a second control. The zone is first in
 * content order and must therefore be what the field resolves.
 */
@Component({
  template: `
    <mlv-form-field>
      <mlv-label>Attachments</mlv-label>
      <mlv-file-upload />
      <mlv-test-native-control />
    </mlv-form-field>
  `,
  imports: [MlvFormField, MlvLabel, MlvFileUpload, TestNativeControl],
})
class SiblingControlHost {}

describe('MlvFileUpload inside mlv-form-field', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
  });

  it('is the control the field resolves, so the projected label names nothing else', async () => {
    const fixture = TestBed.createComponent(SiblingControlHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const field = fixture.debugElement.children[0].componentInstance;
    const projectedLabel: HTMLLabelElement =
      fixture.nativeElement.querySelector(
        'mlv-form-field > div > mlv-label label',
      );
    // The upload zone reports no label target, so nothing outside it may be
    // named — least of all the unrelated control beside it.
    expect(field.labelableControlId()).toBeNull();
    expect(projectedLabel.getAttribute('for')).toBeNull();
  });
});
