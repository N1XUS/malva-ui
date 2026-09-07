# Signal Forms Controls (2026-07)

All Malva form controls now implement Angular's signal-control contract. The same component works with signal forms, reactive forms, and template-driven forms; consumers do not need an adapter.

## Signal forms

```ts
import { Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { InputComponent } from '@malva-ui/core/input';

@Component({
  imports: [FormField, InputComponent],
  template: `<mlv-input label="Email" [formField]="fields.email" />`,
})
export class ProfileForm {
  readonly model = signal({ email: '' });
  readonly fields = form(this.model, (path) => {
    required(path.email, { message: 'Email is required' });
  });
}
```

`[formField]` binds the control's value, validation errors, touched/dirty state, readonly state, and disabled state. Malva's `resolvedState()` turns a touched invalid field red while preserving an explicitly supplied non-default `state`.

## Existing forms keep working

No template change is required for existing reactive or template-driven consumers:

```html
<mlv-input [formControl]="email" /> <mlv-input [(ngModel)]="emailValue" />
```

Angular bridges those directives to the same signal-control contract. Malva's binding matrix verifies value, touch, and disabled propagation in all three modes for every form control.

## Custom code changes

`FormControlBase` and `NG_VALUE_ACCESSOR` providers have been removed from Malva controls. Code that subclasses the old base should move to `SignalFormControlBase<T>` and expose a model signal:

```ts
import { computed, model } from '@angular/core';
import { SignalFormControlBase } from '@malva-ui/core/form-utils';

export class QuantityControl extends SignalFormControlBase<number> {
  readonly value = model(0);
  readonly hasValue = computed(() => this.value() !== 0);

  protected onBlur(): void {
    this._markTouched();
  }
}
```

For checkbox-shaped controls, extend `SignalCheckboxControlBase` and expose `checked = model(false)` instead of `value`.

The following CVA-era methods are no longer part of control instances:

- `writeValue`
- `registerOnChange`
- `registerOnTouched`
- `setDisabledState`

Write programmatic values through the bound form or the public `value`/`checked` model. Emit touch through `_markTouched()` when the user leaves the control.

## Incremental application migration

Applications can adopt signal forms one field at a time. Angular's `compatForm()` from `@angular/forms/signals/compat` supports a top-down migration where existing `AbstractControl` consumers must coexist with a signal field tree. `SignalFormControl` supports a bottom-up bridge where an existing reactive form needs to consume a signal field. Malva controls require no special compatibility layer in either direction.
