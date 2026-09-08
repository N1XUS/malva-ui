import {
  ChangeDetectionStrategy,
  Component,
  computed,
  model,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { MlvFormControlLabelStrategy } from '../models/form-control-connector';
import { MlvLabel } from '../label/label';
import { MlvSignalFormControlBase } from './signal-form-control-base';

/**
 * A control that renders its own `<mlv-label>` the way the eight shipped ones
 * do, with its association strategy under the spec's control.
 *
 * `mlv-select` flips between `'native'` and `'aria'` at runtime as its native
 * `<select>` takes over, so the strategy is read through a signal here too —
 * a `_ownLabelFor` that resolved once would pass a static-endpoint spec.
 */
@Component({
  selector: 'mlv-test-own-label-control',
  imports: [MlvLabel],
  template: `
    <mlv-label [for]="_ownLabelFor()">{{ label() }}</mlv-label>
    <input [id]="id()" [value]="value()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestOwnLabelControl extends MlvSignalFormControlBase<string> {
  readonly value = model('');
  readonly hasValue = computed(() => this.value().length > 0);

  /** The strategy this double reports, writable from the spec. */
  readonly strategy = signal<MlvFormControlLabelStrategy>('none');

  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return this.strategy();
  }

  /** @internal Exposes the protected computed for direct assertion. */
  readonly ownLabelFor = computed(() => this._ownLabelFor());
}

@Component({
  imports: [TestOwnLabelControl],
  template: `<mlv-test-own-label-control label="Email" id="ctrl-1" />`,
})
class Host {}

/**
 * `_ownLabelFor()` is the shared answer eight templates bind, but every
 * assertion protecting it lived in the seven downstream projects that consume
 * it — so a refactor inside `form-utils` passed this library's own suite
 * (#216 review). This is that missing coverage: the rule is
 * `labelTarget()?.labelable ? labelTarget().id : null`, expressed against each
 * of the three strategies plus a live flip between them.
 */
describe('MlvSignalFormUiControlBase._ownLabelFor (#216)', () => {
  let fixture: ComponentFixture<Host>;
  let control: TestOwnLabelControl;

  const label = (): HTMLLabelElement =>
    fixture.nativeElement.querySelector('label') as HTMLLabelElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    control = fixture.debugElement.children[0]
      .componentInstance as TestOwnLabelControl;
  });

  async function setStrategy(
    strategy: MlvFormControlLabelStrategy,
  ): Promise<void> {
    control.strategy.set(strategy);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it("resolves the control id while the target is labelable ('native')", async () => {
    await setStrategy('native');

    expect(control.ownLabelFor()).toBe('ctrl-1');
    expect(label().getAttribute('for')).toBe('ctrl-1');
  });

  it("resolves null while the target is named by aria-labelledby ('aria')", async () => {
    await setStrategy('aria');

    // `labelTarget()` is non-null here — the id is published for the field's
    // `aria-labelledby` — but it is not labelable, so the control's own label
    // must not point `for` at it.
    expect(control.labelTarget()).toEqual({ id: 'ctrl-1', labelable: false });
    expect(control.ownLabelFor()).toBeNull();
    expect(label().hasAttribute('for')).toBe(false);
  });

  it("resolves null when nothing outside may name the control ('none')", async () => {
    await setStrategy('none');

    expect(control.labelTarget()).toBeNull();
    expect(control.ownLabelFor()).toBeNull();
    expect(label().hasAttribute('for')).toBe(false);
  });

  it('follows a live strategy flip in both directions', async () => {
    await setStrategy('native');
    expect(label().getAttribute('for')).toBe('ctrl-1');

    await setStrategy('aria');
    expect(label().hasAttribute('for')).toBe(false);

    await setStrategy('native');
    expect(label().getAttribute('for')).toBe('ctrl-1');
  });
});
