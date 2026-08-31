import {
  Component,
  computed,
  forwardRef,
  model,
  viewChild,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import { MlvDescription } from '../description/description';
import { MlvSignalFormControlBase } from '../form-control-base/signal-form-control-base';
import { MlvFormControlInset } from '../form-control-sides';
import { MlvMessage } from '../message/message';
import { MLV_FORM_CONTROL } from '../models/form-control-connector';
import { MlvFormControlWrapper } from './form-control-wrapper';
import { MlvFormControlWrapperControl } from './form-control-wrapper-control';

@Component({
  imports: [MlvFormControlWrapper, MlvFormControlWrapperControl],
  template: `
    <mlv-form-control-wrapper>
      <ng-template mlvFormControlWrapperControl>
        <input />
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
        <input data-main-control />
      </ng-template>
    </mlv-form-control-wrapper>
  `,
})
class InsetControlComponent extends MlvSignalFormControlBase<string> {
  readonly value = model('');
  readonly hasValue = computed(() => this.value().length > 0);
  readonly wrapper = viewChild.required(MlvFormControlWrapper);
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
  imports: [
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvDescription,
    MlvMessage,
  ],
  template: `
    <mlv-form-control-wrapper>
      <ng-template mlvFormControlWrapperControl>
        <input />
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

    const results = await axe.run(clearFixture.nativeElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map(({ id }) => id)).not.toContain(
      'nested-interactive',
    );

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
