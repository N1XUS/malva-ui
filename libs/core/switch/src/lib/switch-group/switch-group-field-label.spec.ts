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

import { MlvSwitchGroup } from './switch-group';
import { MlvSwitch } from '../switch/switch';

/**
 * Stand-in for the labelable half of the control family (`mlv-input`,
 * `mlv-textarea`, `mlv-number-input`, …): the control's `id` lands on a native
 * `<input>`, so a `<label for>` names it.
 *
 * A stub rather than the real `mlv-input` so `core-switch` gains no dependency
 * on `core-input`; the mechanism under test is which node `mlv-form-field`
 * resolves through `MLV_FORM_CONTROL`, which is strategy-driven and identical
 * for either.
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
 * Consequence (a): the field must resolve the **group**, not a labelable
 * control nested inside it. `contentChild` defaults to `descendants: true`, so
 * without a provider on the group the query walks straight past it.
 */
@Component({
  template: `
    <mlv-form-field>
      <mlv-label>Notify me</mlv-label>
      <mlv-switch-group>
        <mlv-test-native-control />
      </mlv-switch-group>
    </mlv-form-field>
  `,
  imports: [MlvFormField, MlvLabel, MlvSwitchGroup, TestNativeControl],
})
class NestedControlHost {}

/**
 * Consequence (b): the group's **own** `<mlv-label>`, rendered in its view from
 * its `label` input, must not borrow the enclosing field's label target — that
 * target belongs to a different control entirely.
 */
@Component({
  template: `
    <mlv-form-field>
      <mlv-test-native-control />
      <mlv-switch-group label="Notify me">
        <mlv-switch>Email</mlv-switch>
      </mlv-switch-group>
    </mlv-form-field>
  `,
  imports: [MlvFormField, MlvSwitchGroup, MlvSwitch, TestNativeControl],
})
class OwnLabelHost {}

/**
 * The naming contract, mirroring `mlv-radio-group`: a `role="group"` takes its
 * accessible name from a projected `<mlv-label>` through `aria-labelledby`, and
 * a label written on the group itself wins over one projected beside it.
 */
@Component({
  imports: [MlvFormField, MlvLabel, MlvSwitchGroup, MlvSwitch],
  template: `
    <mlv-form-field>
      <mlv-label>Notify me</mlv-label>
      <mlv-switch-group label="Channels">
        <mlv-switch>Email</mlv-switch>
      </mlv-switch-group>
    </mlv-form-field>
  `,
})
class BothLabelsHost {}

@Component({
  imports: [MlvFormField, MlvLabel, MlvSwitchGroup, MlvSwitch],
  template: `
    <mlv-form-field>
      <mlv-label>Notify me</mlv-label>
      <mlv-switch-group>
        <mlv-switch>Email</mlv-switch>
      </mlv-switch-group>
    </mlv-form-field>
  `,
})
class FieldLabelOnlyHost {}

describe('MlvSwitchGroup — accessible name inside mlv-form-field', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
  });

  /**
   * Resolves the group's accessible name the way the accname algorithm does,
   * for the two sources this component can produce: `aria-labelledby` (which
   * outranks `aria-label`) dereferenced to its target's text, else
   * `aria-label`.
   */
  function namedBy(root: HTMLElement, group: HTMLElement): string | null {
    const id = group.getAttribute('aria-labelledby');
    if (id === null) return group.getAttribute('aria-label');
    return root.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? null;
  }

  async function render<T>(
    host: new () => T,
  ): Promise<{ root: HTMLElement; group: HTMLElement }> {
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      root,
      group: root.querySelector('mlv-switch-group') as HTMLElement,
    };
  }

  it("takes the field's projected label as its accessible name", async () => {
    const { root, group } = await render(FieldLabelOnlyHost);

    expect(group.getAttribute('role')).toBe('group');
    expect(namedBy(root, group)).toBe('Notify me');
  });

  it("announces the group's own label, not the field's", async () => {
    const { root, group } = await render(BothLabelsHost);

    expect(namedBy(root, group)).toBe('Channels');
  });

  it('reports the element that carries role="group" as its label target', async () => {
    const fixture = TestBed.createComponent(FieldLabelOnlyHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const group = fixture.debugElement.query(
      (de) => de.componentInstance instanceof MlvSwitchGroup,
    ).componentInstance as MlvSwitchGroup;

    // `mlv-switch-group` carries `role="group"` on its host, unlike
    // `mlv-checkbox-group`, which uses an inner <div>. The id the field is told
    // to name must be on whichever of the two it is; naming the other leaves
    // the group anonymous while every attribute looks right.
    const target = root.querySelector(`#${group.labelTarget()?.id}`);
    expect(target).not.toBeNull();
    expect(target?.getAttribute('role')).toBe('group');
    expect(group.labelTarget()?.labelable).toBe(false);
  });

  it('emits no empty aria-label when it has no label of its own', async () => {
    const { group } = await render(FieldLabelOnlyHost);

    expect(group.getAttribute('aria-label')).toBeNull();
  });
});

describe('MlvSwitchGroup inside mlv-form-field', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
  });

  it('resolves the group itself, not a labelable control nested inside it', async () => {
    const fixture = TestBed.createComponent(NestedControlHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const field = fixture.debugElement.children[0].componentInstance;
    const projectedLabel: HTMLLabelElement =
      fixture.nativeElement.querySelector(
        'mlv-form-field > div > mlv-label label',
      );
    // The group's label target is the `role="group"` element, which is not
    // HTML-labelable — so the field resolves no `for`-able id at all. Before
    // the group provided `MLV_FORM_CONTROL` this read the nested control's id.
    expect(field.labelableControlId()).toBeNull();
    // And the projected label must therefore emit no `for` at all.
    expect(projectedLabel.getAttribute('for')).toBeNull();
  });

  it("does not let the group's own label borrow the field's label target", async () => {
    const fixture = TestBed.createComponent(OwnLabelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const groupLabel: HTMLLabelElement = fixture.nativeElement.querySelector(
      '.mlv-switch-group mlv-label label',
    );
    expect(groupLabel.textContent?.trim()).toBe('Notify me');
    expect(groupLabel.getAttribute('for')).toBeNull();
  });
});
