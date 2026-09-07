import type { ModelSignal, Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  model,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

import { MlvFormField } from './form-field';
import { MlvLabel } from '../label/label';
import { MlvSignalFormControlBase } from '../form-control-base/signal-form-control-base';
import { MLV_FORM_CONTROL } from '../models/form-control-connector';
import type { MlvFormControlLabelStrategy } from '../models/form-field-connector';

/**
 * A stand-in for the labelable half of the control family (`mlv-input`,
 * `mlv-textarea`, `mlv-number-input`, …): the control's `id` lands on a native
 * `<input>`, so `<label for>` names it.
 *
 * The real controls are not importable here — `core-form-utils` is upstream of
 * every one of them — so the mechanism is pinned against the two shapes it
 * distinguishes, and the composition with the real `mlv-input` / `mlv-select`
 * is pinned in `apps/docs/src/app/pages/form-field/examples/1/index.spec.ts`.
 */
@Component({
  selector: 'test-native-control',
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
 * A stand-in for the non-labelable half (`mlv-select`'s custom trigger,
 * `mlv-day-picker`, `mlv-radio-group`, …): the id lands on a
 * `div[role="combobox"]`, which `<label for>` cannot name.
 */
@Component({
  selector: 'test-aria-control',
  template: `<div
    [id]="id()"
    role="combobox"
    tabindex="0"
    aria-expanded="false"
    aria-controls="test-listbox"
    [attr.aria-labelledby]="_fieldLabelId()"
  ></div>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => TestAriaControl),
    },
  ],
})
class TestAriaControl extends MlvSignalFormControlBase<string> {
  readonly value: ModelSignal<string> = model('');
  readonly hasValue: Signal<boolean> = computed(() => this.value() !== '');
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'aria';
  }
}

/**
 * A stand-in for a composite control (`mlv-slider`'s two thumbs,
 * `mlv-pin-input`'s cells): no single element outside it can be named, so the
 * base's `'none'` default stands.
 */
@Component({
  selector: 'test-opaque-control',
  template: `<div role="group" aria-label="Opaque"></div>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => TestOpaqueControl),
    },
  ],
})
class TestOpaqueControl extends MlvSignalFormControlBase<string> {
  readonly value: ModelSignal<string> = model('');
  readonly hasValue: Signal<boolean> = computed(() => this.value() !== '');
}

/**
 * A second `'none'` control, used only by the dev-warning test.
 *
 * The warning de-duplicates per control tag through a module-scoped set — the
 * same shape as `WARNED_UNMAPPED_KEYS` — and that set outlives a `TestBed`
 * reset. Sharing {@link TestOpaqueControl} would make the warning test pass or
 * fail on file order, which is exactly the kind of green-for-the-wrong-reason
 * this suite is meant to rule out.
 */
@Component({
  selector: 'test-unnamed-control',
  template: `<div role="group" aria-label="Unnamed"></div>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => TestUnnamedControl),
    },
  ],
})
class TestUnnamedControl extends MlvSignalFormControlBase<string> {
  readonly value: ModelSignal<string> = model('');
  readonly hasValue: Signal<boolean> = computed(() => this.value() !== '');
}

/**
 * A `'native'` control that renders its own `<mlv-label>` with no `for`, the
 * way `mlv-radio-group` / `mlv-segmented` / `mlv-checkbox-group` do.
 */
@Component({
  selector: 'test-self-labelling-control',
  imports: [MlvLabel],
  template: `<mlv-label>Inner</mlv-label><input [id]="id()" />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => TestSelfLabellingControl),
    },
  ],
})
class TestSelfLabellingControl extends MlvSignalFormControlBase<string> {
  readonly value: ModelSignal<string> = model('');
  readonly hasValue: Signal<boolean> = computed(() => this.value() !== '');
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'native';
  }
}

@Component({
  imports: [MlvFormField, MlvLabel, TestSelfLabellingControl],
  template: `
    <mlv-form-field>
      <mlv-label>Projected</mlv-label>
      <test-self-labelling-control />
    </mlv-form-field>
  `,
})
class NestedLabelHost {}

/**
 * A control that renders its own `<mlv-label for>` from its `label` input, the
 * way `mlv-input`, `mlv-textarea` and `mlv-color-picker-popup` do. Composed
 * into a field that also projects one, the two `<label for>` elements name the
 * same input and the accessible name becomes their concatenation.
 */
@Component({
  selector: 'test-own-label-control',
  imports: [MlvLabel],
  template: `
    @if (label()) {
      <mlv-label [for]="id()">{{ label() }}</mlv-label>
    }
    <input [id]="id()" />
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => TestOwnLabelControl),
    },
  ],
})
class TestOwnLabelControl extends MlvSignalFormControlBase<string> {
  readonly value: ModelSignal<string> = model('');
  readonly hasValue: Signal<boolean> = computed(() => this.value() !== '');
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'native';
  }
}

@Component({
  imports: [MlvFormField, MlvLabel, TestOwnLabelControl],
  template: `
    <mlv-form-field>
      <mlv-label>Projected</mlv-label>
      <test-own-label-control label="Own" />
    </mlv-form-field>
  `,
})
class DoubleLabelHost {}

@Component({
  imports: [MlvFormField, MlvLabel, TestUnnamedControl],
  template: `
    <mlv-form-field>
      <mlv-label>Unnamed</mlv-label>
      <test-unnamed-control />
    </mlv-form-field>
  `,
})
class WarnHost {}

@Component({
  imports: [
    MlvFormField,
    MlvLabel,
    TestNativeControl,
    TestAriaControl,
    TestOpaqueControl,
  ],
  template: `
    <mlv-form-field>
      <mlv-label [for]="explicitFor()">Email</mlv-label>
      @switch (kind()) {
        @case ('native') {
          <test-native-control />
        }
        @case ('aria') {
          <test-aria-control />
        }
        @case ('opaque') {
          <test-opaque-control />
        }
      }
    </mlv-form-field>
  `,
})
class HostComponent {
  readonly kind = signal<'native' | 'aria' | 'opaque' | 'none'>('native');
  readonly explicitFor = signal('');
}

/** A bare `<mlv-label>` with no enclosing field, to pin the standalone path. */
@Component({
  imports: [MlvLabel],
  template: `<mlv-label>Standalone</mlv-label>`,
})
class BareLabelHost {}

describe('MlvFormField — label ↔ control association (#197)', () => {
  async function render(
    kind: 'native' | 'aria' | 'opaque' | 'none' = 'native',
    explicitFor = '',
  ): Promise<{ host: HTMLElement; label: HTMLLabelElement }> {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.kind.set(kind);
    fixture.componentInstance.explicitFor.set(explicitFor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return { host, label: host.querySelector('label') as HTMLLabelElement };
  }

  it('points the label at a labelable control through the native `for`', async () => {
    const { host, label } = await render('native');

    const input = host.querySelector('input') as HTMLInputElement;
    expect(input.id).not.toBe('');
    expect(label.getAttribute('for')).toBe(input.id);
    // The native association is the whole name: no ARIA is layered on top.
    expect(input.getAttribute('aria-labelledby')).toBeNull();

    await expectNoAxeViolations(host);
  });

  it('names a non-labelable control through `aria-labelledby`, and emits no `for`', async () => {
    const { host, label } = await render('aria');

    const combobox = host.querySelector('[role="combobox"]') as HTMLElement;
    expect(label.id).not.toBe('');
    expect(combobox.getAttribute('aria-labelledby')).toBe(label.id);
    // A `for` naming a <div> is the failure mode this replaces: it reads as
    // associated in review and focuses nothing.
    expect(label.hasAttribute('for')).toBe(false);
  });

  it('emits no `for` attribute at all when nothing resolves', async () => {
    // This composition is exactly what the dev-mode warning below reports; the
    // spy keeps the expected diagnostic out of the suite's stderr.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { label } = await render('opaque');

    // Not `for=""` — the old default, which is a dangling attribute rather
    // than an absent one.
    expect(label.hasAttribute('for')).toBe(false);

    warn.mockRestore();
  });

  it('warns once in dev mode when a projected label names nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [WarnHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const first = TestBed.createComponent(WarnHost);
    first.detectChanges();
    await first.whenStable();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('TestUnnamedControl');
    expect(warn.mock.calls[0][0]).toContain('names nothing');

    // A second field hitting the same control must stay silent.
    const second = TestBed.createComponent(WarnHost);
    second.detectChanges();
    await second.whenStable();
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('never overrides a consumer-supplied `for`', async () => {
    const { host, label } = await render('native', 'consumer-owned');

    const input = host.querySelector('input') as HTMLInputElement;
    expect(label.getAttribute('for')).toBe('consumer-owned');
    // The control keeps its own generated id — the field resolves the label,
    // it does not rewrite the control.
    expect(input.id).not.toBe('consumer-owned');
  });

  it("does not let a control's own inner label borrow the field's target", async () => {
    await TestBed.configureTestingModule({
      imports: [NestedLabelHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(NestedLabelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const [projected, inner] = Array.from(host.querySelectorAll('label'));
    const input = host.querySelector('input') as HTMLInputElement;

    expect(projected.getAttribute('for')).toBe(input.id);
    // The inner one is the control's own; it is not the field's composition
    // point and must not resolve through it.
    expect(inner.hasAttribute('for')).toBe(false);
  });

  it('warns once in dev mode when the control also renders its own label', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [DoubleLabelHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const first = TestBed.createComponent(DoubleLabelHost);
    first.detectChanges();
    await first.whenStable();

    const host = first.nativeElement as HTMLElement;
    const input = host.querySelector('input') as HTMLInputElement;
    // The shape itself: two <label for> pointing at one control, which the
    // accname algorithm concatenates rather than picking between.
    expect(
      Array.from(host.querySelectorAll('label')).filter(
        (label) => label.getAttribute('for') === input.id,
      ).length,
    ).toBe(2);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('TestOwnLabelControl');
    expect(warn.mock.calls[0][0]).toContain('two labels');

    const second = TestBed.createComponent(DoubleLabelHost);
    second.detectChanges();
    await second.whenStable();
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('emits no `for` on a standalone label outside any field', async () => {
    await TestBed.configureTestingModule({
      imports: [BareLabelHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(BareLabelHost);
    await fixture.whenStable();

    const label = (fixture.nativeElement as HTMLElement).querySelector(
      'label',
    ) as HTMLLabelElement;
    expect(label.hasAttribute('for')).toBe(false);
    // Still addressable, so a control that wants `aria-labelledby` can point
    // at it even outside a field.
    expect(label.id).toMatch(/^mlv-label-\d+$/);
  });
});
