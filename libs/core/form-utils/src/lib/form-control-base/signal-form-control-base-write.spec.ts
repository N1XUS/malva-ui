import { TestBed } from '@angular/core/testing';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { disabled, form, FormField, readonly } from '@angular/forms/signals';
import {
  MlvSignalCheckboxControlBase,
  MlvSignalFormControlBase,
} from './signal-form-control-base';

/**
 * The write-permission contract every Malva control shares (#298): a user
 * interaction may write the model only while the control is neither
 * `readonly` nor disabled, and the form → control direction is never gated.
 *
 * The fixtures expose the protected primitive through public wrappers so the
 * spec can drive it the way a control's keyboard / pointer / paste handler
 * does, without depending on any one control's template.
 */
@Component({
  selector: 'mlv-test-write-value',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestValueControl extends MlvSignalFormControlBase<string> {
  readonly value = model('');
  readonly hasValue = computed(() => this.value().length > 0);

  /** What a user-interaction handler would do. */
  userWrite(next: string): boolean {
    return this._write(next);
  }

  /** The permission the handler would consult. */
  canWrite(): boolean {
    return this._canWrite();
  }
}

@Component({
  selector: 'mlv-test-write-checked',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestCheckedControl extends MlvSignalCheckboxControlBase {
  readonly checked = model(false);
  readonly hasValue = computed(() => this.checked());

  userWrite(next: boolean): boolean {
    return this._write(next);
  }

  canWrite(): boolean {
    return this._canWrite();
  }
}

@Component({
  template: `
    <mlv-test-write-value
      [readonly]="ro()"
      [disabled]="dis()"
      [(value)]="value"
    />
    <mlv-test-write-checked
      [readonly]="ro()"
      [disabled]="dis()"
      [(checked)]="checked"
    />
  `,
  imports: [TestValueControl, TestCheckedControl],
})
class InputBoundHost {
  readonly ro = signal(false);
  readonly dis = signal(false);
  readonly value = signal('initial');
  readonly checked = signal(false);
  readonly valueControl = viewChild.required(TestValueControl);
  readonly checkedControl = viewChild.required(TestCheckedControl);
}

async function createInputBound() {
  await TestBed.configureTestingModule({
    imports: [InputBoundHost],
  }).compileComponents();
  const fixture = TestBed.createComponent(InputBoundHost);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('MlvSignalFormUiControlBase — write permission (#298)', () => {
  describe('_canWrite', () => {
    it.each([
      { ro: false, dis: false, expected: true },
      { ro: true, dis: false, expected: false },
      { ro: false, dis: true, expected: false },
      { ro: true, dis: true, expected: false },
    ])(
      'readonly=$ro disabled=$dis → $expected, on both bases',
      async ({ ro, dis, expected }) => {
        const fixture = await createInputBound();
        const host = fixture.componentInstance;
        host.ro.set(ro);
        host.dis.set(dis);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(host.valueControl().canWrite()).toBe(expected);
        expect(host.checkedControl().canWrite()).toBe(expected);
      },
    );

    it('follows the inputs back to writable', async () => {
      const fixture = await createInputBound();
      const host = fixture.componentInstance;
      host.ro.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.valueControl().canWrite()).toBe(false);

      host.ro.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.valueControl().canWrite()).toBe(true);
    });
  });

  describe('_write', () => {
    it.each(['readonly', 'disabled'] as const)(
      'refuses a value write while %s and leaves the bound model untouched',
      async (mode) => {
        const fixture = await createInputBound();
        const host = fixture.componentInstance;
        (mode === 'readonly' ? host.ro : host.dis).set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const written = host.valueControl().userWrite('typed');
        fixture.detectChanges();
        await fixture.whenStable();

        expect(written).toBe(false);
        expect(host.valueControl().value()).toBe('initial');
        expect(host.value()).toBe('initial');
      },
    );

    it.each(['readonly', 'disabled'] as const)(
      'refuses a checked write while %s and leaves the bound model untouched',
      async (mode) => {
        const fixture = await createInputBound();
        const host = fixture.componentInstance;
        (mode === 'readonly' ? host.ro : host.dis).set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const written = host.checkedControl().userWrite(true);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(written).toBe(false);
        expect(host.checkedControl().checked()).toBe(false);
        expect(host.checked()).toBe(false);
      },
    );

    it('writes through to the bound model while writable', async () => {
      const fixture = await createInputBound();
      const host = fixture.componentInstance;

      expect(host.valueControl().userWrite('typed')).toBe(true);
      expect(host.checkedControl().userWrite(true)).toBe(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.value()).toBe('typed');
      expect(host.checked()).toBe(true);
    });

    it('never gates the form → control direction', async () => {
      const fixture = await createInputBound();
      const host = fixture.componentInstance;
      host.ro.set(true);
      host.dis.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      host.value.set('from the form');
      host.checked.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.valueControl().value()).toBe('from the form');
      expect(host.checkedControl().checked()).toBe(true);
    });
  });

  describe('forms transports', () => {
    it('a signal-forms readonly() rule blocks the write and the field keeps its value', async () => {
      @Component({
        template: `<mlv-test-write-value [formField]="f.name" />`,
        imports: [TestValueControl, FormField],
      })
      class SignalReadonlyHost {
        readonly locked = signal(true);
        readonly model = signal({ name: 'Ada' });
        readonly f = form(this.model, (path) => {
          readonly(path.name, () => this.locked());
        });
        readonly control = viewChild.required(TestValueControl);
      }

      await TestBed.configureTestingModule({
        imports: [SignalReadonlyHost],
      }).compileComponents();
      const fixture = TestBed.createComponent(SignalReadonlyHost);
      fixture.detectChanges();
      await fixture.whenStable();
      const host = fixture.componentInstance;

      expect(host.f.name().readonly()).toBe(true);
      expect(host.control().readonly()).toBe(true);
      expect(host.control().userWrite('Grace')).toBe(false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.f.name().value()).toBe('Ada');

      // Lifting the rule restores the write.
      host.locked.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.control().userWrite('Grace')).toBe(true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.f.name().value()).toBe('Grace');
    });

    it('a signal-forms disabled() rule blocks the write', async () => {
      @Component({
        template: `<mlv-test-write-checked [formField]="f.agree" />`,
        imports: [TestCheckedControl, FormField],
      })
      class SignalDisabledHost {
        readonly model = signal({ agree: false });
        readonly f = form(this.model, (path) => {
          disabled(path.agree, () => true);
        });
        readonly control = viewChild.required(TestCheckedControl);
      }

      await TestBed.configureTestingModule({
        imports: [SignalDisabledHost],
      }).compileComponents();
      const fixture = TestBed.createComponent(SignalDisabledHost);
      fixture.detectChanges();
      await fixture.whenStable();
      const host = fixture.componentInstance;

      expect(host.control().userWrite(true)).toBe(false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.f.agree().value()).toBe(false);
    });

    it('a disabled reactive FormControl blocks the write', async () => {
      @Component({
        template: `<mlv-test-write-value [formControl]="ctrl" />`,
        imports: [TestValueControl, ReactiveFormsModule],
      })
      class ReactiveHost {
        readonly ctrl = new FormControl('kept', { nonNullable: true });
        readonly control = viewChild.required(TestValueControl);
      }

      await TestBed.configureTestingModule({
        imports: [ReactiveHost],
      }).compileComponents();
      const fixture = TestBed.createComponent(ReactiveHost);
      fixture.detectChanges();
      await fixture.whenStable();
      const host = fixture.componentInstance;

      host.ctrl.disable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.control().userWrite('changed')).toBe(false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.ctrl.value).toBe('kept');
    });
  });
});
