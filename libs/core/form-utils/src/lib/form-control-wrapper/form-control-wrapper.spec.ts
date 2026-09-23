import {
  Component,
  computed,
  forwardRef,
  model,
  signal,
  viewChild,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import { MlvDescription } from '../description/description';
import { MlvSignalFormControlBase } from '../form-control-base/signal-form-control-base';
import { MlvFormControlInset } from '../form-control-sides';
import { MlvMessage } from '../message/message';
import type { MlvFormControl } from '../models/form-control-connector';
import { MLV_FORM_CONTROL } from '../models/form-control-connector';
import type { MlvFormState } from '../models/form-state';
import { MlvFormControlWrapper } from './form-control-wrapper';
import { MlvFormControlWrapperControl } from './form-control-wrapper-control';

@Component({
  imports: [MlvFormControlWrapper, MlvFormControlWrapperControl],
  template: `
    <mlv-form-control-wrapper>
      <ng-template mlvFormControlWrapperControl>
        <input aria-label="Test control" />
      </ng-template>
    </mlv-form-control-wrapper>
  `,
})
class HostComponent {
  readonly wrapper = viewChild.required(MlvFormControlWrapper);
}

@Component({
  selector: 'test-inset-control',
  imports: [MlvFormControlWrapper, MlvFormControlWrapperControl],
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => InsetControlComponent),
    },
  ],
  template: `
    <mlv-form-control-wrapper>
      <ng-template mlvFormControlWrapperControl>
        <input data-main-control aria-label="Test control" />
      </ng-template>
    </mlv-form-control-wrapper>
  `,
})
class InsetControlComponent extends MlvSignalFormControlBase<string> {
  readonly value = model('');
  readonly hasValue = computed(() => this.value().length > 0);
  readonly wrapper = viewChild.required(MlvFormControlWrapper);

  /** Exposes the protected permission the wrapper's X must agree with. */
  userMayWrite(): boolean {
    return this._canWrite();
  }
}

@Component({
  imports: [InsetControlComponent, MlvFormControlInset],
  template: `
    <test-inset-control clearable>
      <div *mlvFormControlInset data-inset>Strength</div>
    </test-inset-control>
  `,
})
class InsetHostComponent {
  readonly control = viewChild.required(InsetControlComponent);
}

@Component({
  imports: [InsetControlComponent],
  template: `
    <test-inset-control
      clearable
      [readonly]="readonly()"
      [disabled]="disabled()"
      [(value)]="value"
    />
  `,
})
class PermissionHostComponent {
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly value = signal('clear me');
  readonly control = viewChild.required(InsetControlComponent);
}

/**
 * A connector written by hand rather than inherited from
 * `MlvSignalFormUiControlBase` — the shape an externally-authored control has,
 * with no `_canWrite` behind it. The wrapper reads write permission off the
 * connector's own `readonly` / `disabled`, so it must refuse to offer an X on
 * this one too.
 */
@Component({
  selector: 'test-raw-connector-control',
  imports: [MlvFormControlWrapper, MlvFormControlWrapperControl],
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => RawConnectorControlComponent),
    },
  ],
  template: `
    <mlv-form-control-wrapper>
      <ng-template mlvFormControlWrapperControl>
        <input aria-label="Raw control" />
      </ng-template>
    </mlv-form-control-wrapper>
  `,
})
class RawConnectorControlComponent implements MlvFormControl {
  readonly focused = signal(false);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  readonly state = signal<MlvFormState>('default');
  readonly loading = signal(false);
  readonly clearable = signal(true);
  readonly hasValue = signal(true);
  readonly prepend = signal(undefined);
  readonly append = signal(undefined);
  readonly inset = signal(undefined);
}

@Component({
  imports: [RawConnectorControlComponent],
  template: `<test-raw-connector-control />`,
})
class RawConnectorHostComponent {
  readonly control = viewChild.required(RawConnectorControlComponent);
}

@Component({
  imports: [
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvDescription,
    MlvMessage,
  ],
  template: `
    <mlv-form-control-wrapper>
      <ng-template mlvFormControlWrapperControl>
        <input aria-label="Test control" />
      </ng-template>
      <mlv-description id="d1">Help text</mlv-description>
      <mlv-message state="error">Too short</mlv-message>
      <div mlvFormControlWrapperAside data-aside>3/10</div>
    </mlv-form-control-wrapper>
  `,
})
class BelowControlHostComponent {}

describe('MlvFormControlWrapper', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    // MlvFormControlWrapper has a `contentChild.required(MlvFormControlWrapperControl)`
    // query, so it must be rendered with a projected
    // `<ng-template mlvFormControlWrapperControl>` — creating it standalone
    // (with no projected content) throws NG0951. A host component supplies
    // the required projected content, matching real usage.
    await TestBed.configureTestingModule({
      imports: [HostComponent, InsetHostComponent, BelowControlHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance.wrapper()).toBeTruthy();
  });

  it('renders inset content inside the bordered control after the main control row', async () => {
    const insetFixture = TestBed.createComponent(InsetHostComponent);
    await insetFixture.whenStable();

    const container = insetFixture.nativeElement.querySelector(
      '.mlv-form-control-wrapper__control-container',
    ) as HTMLElement;
    const row = container.querySelector(
      '.mlv-form-control-wrapper__control-row',
    );
    const inset = container.querySelector(
      '.mlv-form-control-wrapper__inset [data-inset]',
    );

    expect(row?.querySelector('[data-main-control]')).toBeTruthy();
    expect(inset?.textContent).toContain('Strength');
    expect(container.lastElementChild?.classList).toContain(
      'mlv-form-control-wrapper__inset',
    );
  });

  it('keeps the wrapper clear action as one native button and emits once', async () => {
    const clearFixture = TestBed.createComponent(InsetHostComponent);
    const control = clearFixture.componentInstance.control();
    control.value.set('clear me');
    clearFixture.detectChanges();
    await clearFixture.whenStable();

    const cleared = vi.fn();
    control.wrapper().clear.subscribe(cleared);
    const closeHost = clearFixture.nativeElement.querySelector(
      'mlv-button-close',
    ) as HTMLElement;
    const clearButton = closeHost.querySelector('button') as HTMLButtonElement;
    expect(closeHost).not.toBeNull();
    expect(closeHost.getAttribute('role')).toBeNull();
    expect(closeHost.getAttribute('tabindex')).toBeNull();
    expect(closeHost.querySelectorAll('button')).toHaveLength(1);

    await expectNoAxeViolations(clearFixture.nativeElement);

    clearButton.click();
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('projects description, message and aside below the control, in that order', async () => {
    const belowFixture = TestBed.createComponent(BelowControlHostComponent);
    await belowFixture.whenStable();

    const container = belowFixture.nativeElement.querySelector(
      '.mlv-form-control-wrapper__message-container',
    ) as HTMLElement;
    const children = Array.from(container.children).map((el) => el.tagName);

    expect(children).toEqual(['MLV-DESCRIPTION', 'MLV-MESSAGE', 'DIV']);
    expect(
      (container.querySelector('mlv-description') as HTMLElement).textContent,
    ).toContain('Help text');
    expect(
      (container.querySelector('[data-aside]') as HTMLElement).textContent,
    ).toContain('3/10');
  });
});

/**
 * #301: the trailing X rendered on `clearable() && hasValue()` alone, with no
 * readonly or disabled term. On a readonly field a click emptied it; on a
 * disabled one the inner `<button>` stayed in the tab order (`--disabled` only
 * sets `pointer-events: none`), so Tab + Enter emptied that too.
 */
describe('MlvFormControlWrapper — clear button write permission (#301)', () => {
  const clearSlot = (root: HTMLElement): HTMLElement | null =>
    root.querySelector('.mlv-form-control-wrapper__clear');

  async function renderPermission(
    state: 'writable' | 'readonly' | 'disabled',
  ): Promise<ComponentFixture<PermissionHostComponent>> {
    await TestBed.configureTestingModule({
      imports: [PermissionHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(PermissionHostComponent);
    fixture.componentInstance.readonly.set(state === 'readonly');
    fixture.componentInstance.disabled.set(state === 'disabled');
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('renders the clear button while the control is writable', async () => {
    const fixture = await renderPermission('writable');

    expect(clearSlot(fixture.nativeElement)).not.toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'renders no clear button while the control is %s',
    async (state) => {
      const fixture = await renderPermission(state);
      const root = fixture.nativeElement as HTMLElement;

      expect(clearSlot(root)).toBeNull();
      expect(root.querySelector('mlv-button-close')).toBeNull();
      expect(fixture.componentInstance.value()).toBe('clear me');

      await expectNoAxeViolations(root);
    },
  );

  it.each([
    { ro: false, dis: false },
    { ro: true, dis: false },
    { ro: false, dis: true },
    { ro: true, dis: true },
  ])(
    'offers the X exactly when the control’s own _canWrite() allows (readonly=$ro disabled=$dis)',
    async ({ ro, dis }) => {
      const fixture = await renderPermission('writable');
      fixture.componentInstance.readonly.set(ro);
      fixture.componentInstance.disabled.set(dis);
      await fixture.whenStable();

      const rendered = clearSlot(fixture.nativeElement) !== null;
      expect(rendered).toBe(fixture.componentInstance.control().userMayWrite());
      expect(rendered).toBe(!ro && !dis);
    },
  );

  it('removes the clear button when the control turns readonly, and restores it', async () => {
    const fixture = await renderPermission('writable');
    const root = fixture.nativeElement as HTMLElement;
    expect(clearSlot(root)).not.toBeNull();

    fixture.componentInstance.readonly.set(true);
    await fixture.whenStable();
    expect(clearSlot(root)).toBeNull();

    fixture.componentInstance.readonly.set(false);
    await fixture.whenStable();
    expect(clearSlot(root)).not.toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'honours %s on a hand-written connector too',
    async (state) => {
      await TestBed.configureTestingModule({
        imports: [RawConnectorHostComponent],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();
      const fixture = TestBed.createComponent(RawConnectorHostComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      expect(clearSlot(root)).not.toBeNull();

      fixture.componentInstance.control()[state].set(true);
      await fixture.whenStable();

      expect(clearSlot(root)).toBeNull();
    },
  );
});
