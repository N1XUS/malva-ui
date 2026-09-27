import { Component, DOCUMENT, viewChild } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MlvFormControlAppend,
  MlvFormControlPrepend,
} from '@malva-ui/core/form-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvColorPickerPopup } from './color-picker-popup';

@Component({
  imports: [MlvColorPickerPopup],
  template: `
    <mlv-color-picker-popup presentation="icon" ariaLabel="Text color">
      <svg data-custom-color-icon aria-hidden="true"></svg>
    </mlv-color-picker-popup>
  `,
})
class IconPresentationHost {}

function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(input: HTMLElement, value: string): void {
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: value,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe('MlvColorPickerPopup', () => {
  let component: MlvColorPickerPopup;
  let fixture: ComponentFixture<MlvColorPickerPopup>;
  let hostEl: HTMLElement;
  let overlayContainer: OverlayContainer;
  let overlayEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvColorPickerPopup, IconPresentationHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvColorPickerPopup);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    document.body.appendChild(hostEl);
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayEl = overlayContainer.getContainerElement();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    hostEl.remove();
    overlayContainer.ngOnDestroy();
  });

  function input(): HTMLInputElement {
    return hostEl.querySelector(
      '.mlv-color-picker-popup__input',
    ) as HTMLInputElement;
  }

  function swatchButton(): HTMLButtonElement {
    return hostEl.querySelector(
      '.mlv-color-picker-popup__swatch-button',
    ) as HTMLButtonElement;
  }

  function panel(): HTMLElement | null {
    return overlayEl.querySelector('.mlv-color-picker-popup__panel');
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('creates an input-like control', () => {
    expect(component).toBeTruthy();
    expect(input().value).toBe('#ff0000');
    expect(input().getAttribute('aria-label')).toBe('Color picker');
    expect(swatchButton()).not.toBeNull();
  });

  it('is closed by default', () => {
    expect(panel()).toBeNull();
  });

  it('opens a non-modal connected popup above a CDK backdrop without moving focus', async () => {
    input().focus();
    await settle();

    const backdrop = overlayEl.querySelector('.cdk-overlay-backdrop');
    const panelEl = panel();
    expect(panel()).not.toBeNull();
    expect(backdrop).not.toBeNull();
    expect(
      (backdrop as Node).compareDocumentPosition(panelEl as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      document.querySelector('.mlv-color-picker-popup__backdrop'),
    ).toBeNull();
    expect(
      overlayEl.querySelector('.mlv-popup')?.getAttribute('aria-modal'),
    ).toBeNull();
    expect(document.activeElement).toBe(input());
  });

  it('opens when the rounded swatch is clicked', async () => {
    swatchButton().click();
    await settle();

    expect(panel()).not.toBeNull();
  });

  it('projects a custom icon into the accessible Malva popup trigger', async () => {
    const iconFixture = TestBed.createComponent(IconPresentationHost);
    document.body.appendChild(iconFixture.nativeElement);
    iconFixture.detectChanges();
    await iconFixture.whenStable();

    const trigger = iconFixture.nativeElement.querySelector(
      'button[aria-label="Text color"]',
    ) as HTMLButtonElement;
    expect(trigger.querySelector('[data-custom-color-icon]')).not.toBeNull();
    expect(trigger.textContent?.trim()).toBe('');

    trigger.click();
    iconFixture.detectChanges();
    await iconFixture.whenStable();
    expect(panel()).not.toBeNull();

    iconFixture.destroy();
    iconFixture.nativeElement.remove();
  });

  it('keeps draft text out of the model when Enter is pressed', () => {
    typeInto(input(), '#00ff00');
    fixture.detectChanges();

    expect(input().value).toBe('#00ff00');
    expect(component.value()).toBe('#ff0000');

    key(input(), 'Enter');
    fixture.detectChanges();

    expect(component.value()).toBe('#ff0000');
  });

  it('commits a valid draft on blur', () => {
    typeInto(input(), 'rgba(0, 255, 0, 0.5)');
    input().dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    fixture.detectChanges();

    expect(component.value()).toBe('rgba(0, 255, 0, 0.5)');
  });

  it('accepts a CSS custom-property color on commit', () => {
    typeInto(input(), 'var(--brand-color, #00ff00)');
    input().dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    fixture.detectChanges();

    expect(component.value()).toBe('var(--brand-color, #00ff00)');
  });

  it('restores the last committed value for invalid input', () => {
    typeInto(input(), '#12');
    input().dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    fixture.detectChanges();

    expect(input().value).toBe('#ff0000');
    expect(component.value()).toBe('#ff0000');
  });

  it('restores the last valid draft before committing on blur', () => {
    typeInto(input(), '#00ff00');
    typeInto(input(), '#00ff00x');
    input().dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    fixture.detectChanges();

    expect(input().value).toBe('#00ff00');
    expect(component.value()).toBe('#00ff00');
  });

  it('commits a full clear as an empty value', () => {
    typeInto(input(), '');
    input().dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    fixture.detectChanges();

    expect(component.value()).toBe('');
    expect(component.hasValue()).toBe(false);
  });

  it('rolls an invalid draft back to empty after a full clear', () => {
    typeInto(input(), '');
    input().dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    fixture.detectChanges();

    typeInto(input(), '#12');
    input().dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    fixture.detectChanges();

    expect(input().value).toBe('');
    expect(component.value()).toBe('');
  });

  it('commits a valid draft and closes on Escape', async () => {
    input().focus();
    await settle();
    typeInto(input(), '#00ff00');

    key(input(), 'Escape');
    await settle();
    overlayEl
      .querySelector('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await settle();

    expect(input().value).toBe('#00ff00');
    expect(component.value()).toBe('#00ff00');
    expect(component.opened()).toBe(false);
  });

  it('reopens on input click when Escape left the input focused', async () => {
    input().focus();
    await settle();
    key(input(), 'Escape');
    await settle();
    expect(component.opened()).toBe(false);
    expect(document.activeElement).toBe(input());

    input().click();
    await settle();
    overlayEl
      .querySelector('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await settle();

    expect(component.opened()).toBe(true);
    expect(panel()).not.toBeNull();
  });

  it('defers picker changes by default and synchronizes the draft input', () => {
    const emitted = vi.fn();
    component.colorChange.subscribe(emitted);

    component['_onColorChange']('hsl(120, 100%, 50%)');
    fixture.detectChanges();

    expect(component.value()).toBe('#ff0000');
    expect(input().value).toBe('hsl(120, 100%, 50%)');
    expect(emitted).not.toHaveBeenCalled();
  });

  it('commits picker changes immediately when live is true', () => {
    fixture.componentRef.setInput('live', true);
    fixture.detectChanges();
    const emitted = vi.fn();
    component.colorChange.subscribe(emitted);

    component['_onColorChange']('hsl(120, 100%, 50%)');
    fixture.detectChanges();

    expect(component.value()).toBe('hsl(120, 100%, 50%)');
    expect(emitted).toHaveBeenCalledWith('hsl(120, 100%, 50%)');
  });

  it('commits valid text immediately when live is true', () => {
    fixture.componentRef.setInput('live', true);
    fixture.detectChanges();

    typeInto(input(), 'rgb(0, 255, 0)');
    fixture.detectChanges();

    expect(component.value()).toBe('rgb(0, 255, 0)');
  });

  it('commits a deferred picker draft when the popup closes', async () => {
    const emitted = vi.fn();
    component.colorChange.subscribe(emitted);
    input().focus();
    await settle();

    component['_onColorChange']('rgb(0, 255, 0)');
    fixture.detectChanges();
    component.opened.set(false);
    await settle();
    overlayEl
      .querySelector('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await settle();

    expect(component.value()).toBe('rgb(0, 255, 0)');
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('commits a deferred picker draft when the backdrop closes the popup', async () => {
    input().focus();
    await settle();
    component['_onColorChange']('rgb(0, 255, 0)');
    fixture.detectChanges();

    (overlayEl.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    await settle();
    overlayEl
      .querySelector('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await settle();

    expect(component.value()).toBe('rgb(0, 255, 0)');
    expect(component.opened()).toBe(false);
  });

  it('forwards supportedFormats to the inner picker', async () => {
    fixture.componentRef.setInput('supportedFormats', ['rgb']);
    swatchButton().click();
    await settle();

    expect(overlayEl.querySelector('[role="tablist"]')).toBeNull();
    expect(
      overlayEl.querySelector('input[aria-label="Red channel"]'),
    ).not.toBeNull();
  });

  it('links the input to the open dialog with ARIA', async () => {
    expect(input().getAttribute('aria-haspopup')).toBe('dialog');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().getAttribute('aria-controls')).toBeNull();

    input().focus();
    await settle();

    const panelEl = panel() as HTMLElement;
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(input().getAttribute('aria-controls')).toBe(panelEl.id);
    expect(overlayEl.querySelector('.mlv-popup')?.getAttribute('role')).toBe(
      'dialog',
    );
  });

  it('moves focus into the picker for keyboard swatch activation and restores it on close', async () => {
    key(swatchButton(), 'Enter');
    await settle();

    const panelEl = panel() as HTMLElement;
    expect(panelEl.contains(document.activeElement)).toBe(true);

    key(panelEl, 'Escape');
    await settle();
    overlayEl
      .querySelector('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await settle();

    expect(document.activeElement).toBe(swatchButton());
  });

  it('reflects the inherited state input as a host modifier class', () => {
    fixture.componentRef.setInput('state', 'error');
    fixture.detectChanges();

    expect(
      hostEl.classList.contains('mlv-color-picker-popup--state-error'),
    ).toBe(true);
  });

  it('prevents editing and opening when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(input().disabled).toBe(true);
    expect(swatchButton().disabled).toBe(true);
    swatchButton().click();
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('prevents editing, opening, and clearing when readonly', () => {
    fixture.componentRef.setInput('readonly', true);
    fixture.componentRef.setInput('clearable', true);
    fixture.detectChanges();

    expect(input().readOnly).toBe(true);
    expect(swatchButton().disabled).toBe(true);
    expect(hostEl.querySelector('.mlv-form-control-wrapper__clear')).toBeNull();
    input().dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('closes and blocks picker changes when readonly is enabled while open', async () => {
    input().focus();
    await settle();
    expect(panel()).not.toBeNull();

    fixture.componentRef.setInput('readonly', true);
    await settle();

    expect(component.opened()).toBe(false);
    component['_onColorChange']('#00ff00');
    fixture.detectChanges();
    expect(component.value()).toBe('#ff0000');
  });

  it('synchronizes the picker when the committed value changes while open', async () => {
    input().focus();
    await settle();

    component.value.set('#00ff00');
    await settle();

    expect(component['_pickerValue']()).toBe('#00ff00');
  });
});

@Component({
  template: `
    <mlv-color-picker-popup clearable label="Brand" hint="CSS color">
      <span class="test-prepend" *mlvFormControlPrepend>prefix</span>
      <span class="test-append" *mlvFormControlAppend>suffix</span>
    </mlv-color-picker-popup>
  `,
  imports: [MlvColorPickerPopup, MlvFormControlPrepend, MlvFormControlAppend],
})
class SlotsHost {
  readonly picker = viewChild.required(MlvColorPickerPopup);
}

describe('MlvColorPickerPopup slots and clearable behavior', () => {
  let fixture: ComponentFixture<SlotsHost>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlotsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(SlotsHost);
    overlayContainer = TestBed.inject(OverlayContainer);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    overlayContainer.ngOnDestroy();
  });

  it('renders label, hint, prepend, append, and the standard clear button', () => {
    const root = fixture.nativeElement as HTMLElement;
    const inputEl = root.querySelector(
      '.mlv-color-picker-popup__input',
    ) as HTMLInputElement;
    expect(root.querySelector('.mlv-label')?.textContent).toContain('Brand');
    expect(inputEl.getAttribute('aria-label')).toBeNull();
    expect(root.querySelector('mlv-hint')?.textContent).toContain('CSS color');
    expect(root.querySelector('.test-prepend')?.textContent).toBe('prefix');
    expect(root.querySelector('.test-append')?.textContent).toBe('suffix');
    expect(
      root.querySelector('.mlv-form-control-wrapper__clear'),
    ).not.toBeNull();
  });

  it('clears to an empty value and removes the standard clear button', () => {
    const root = fixture.nativeElement as HTMLElement;
    const emitted = vi.fn();
    fixture.componentInstance.picker().colorChange.subscribe(emitted);
    (
      root.querySelector(
        '.mlv-form-control-wrapper__clear button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.picker().value()).toBe('');
    expect(emitted).toHaveBeenCalledWith('');
    expect(root.querySelector('.mlv-form-control-wrapper__clear')).toBeNull();
  });
});

describe('MlvColorPickerPopup reactive forms', () => {
  @Component({
    template: `<mlv-color-picker-popup [formControl]="ctrl" />`,
    imports: [MlvColorPickerPopup, ReactiveFormsModule],
  })
  class ReactiveHost {
    readonly ctrl = new FormControl<string>('#ff0000', { nonNullable: true });
  }

  let fixture: ComponentFixture<ReactiveHost>;
  let hostEl: HTMLElement;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ReactiveHost);
    hostEl = fixture.nativeElement;
    overlayContainer = TestBed.inject(OverlayContainer);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    overlayContainer.ngOnDestroy();
  });

  it('propagates FormControl.disable() to the input, swatch, and host', () => {
    fixture.componentInstance.ctrl.disable();
    fixture.detectChanges();

    const popupEl = hostEl.querySelector(
      '.mlv-color-picker-popup',
    ) as HTMLElement;
    const inputEl = hostEl.querySelector(
      '.mlv-color-picker-popup__input',
    ) as HTMLInputElement;
    const swatch = hostEl.querySelector(
      '.mlv-color-picker-popup__swatch-button',
    ) as HTMLButtonElement;

    expect(popupEl.classList.contains('mlv-color-picker-popup--disabled')).toBe(
      true,
    );
    expect(inputEl.disabled).toBe(true);
    expect(swatch.disabled).toBe(true);
  });

  it('synchronizes external form writes into the text input', async () => {
    fixture.componentInstance.ctrl.setValue('var(--brand)');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      (
        hostEl.querySelector(
          '.mlv-color-picker-popup__input',
        ) as HTMLInputElement
      ).value,
    ).toBe('var(--brand)');
  });
});

describe('MlvColorPickerPopup (injected DOCUMENT)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * The panel is portaled into the CDK overlay container of the injected
   * document. `_focusPicker()` looked it up with the ambient
   * `document.getElementById`, found nothing there and returned, so a keyboard
   * swatch activation left focus on the swatch.
   */
  it('moves focus into the panel rendered in the injected document', async () => {
    const isolated = document.implementation.createHTMLDocument('popup');
    await TestBed.configureTestingModule({
      imports: [MlvColorPickerPopup],
      providers: [
        provideMlvI18nTesting(),
        { provide: DOCUMENT, useValue: isolated },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvColorPickerPopup);
    const hostEl: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();

    // jsdom moves no `activeElement` inside a `createHTMLDocument()`
    // document, so the focus calls themselves are what is observed.
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    key(
      hostEl.querySelector(
        '.mlv-color-picker-popup__swatch-button',
      ) as HTMLElement,
      'Enter',
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();

    const panel = isolated.querySelector('.mlv-color-picker-popup__panel');
    expect(panel, 'the panel renders into the injected document').toBeTruthy();
    const focusedInPanel = focus.mock.contexts.filter(
      (el) => el instanceof Node && panel?.contains(el),
    ).length;
    expect(focusedInPanel).toBeGreaterThan(0);
    fixture.destroy();
  });

  /**
   * An open popup resolves a CSS-variable value from the swatch's computed
   * background. That runs from the value `effect()`, so it reaches server
   * change detection when the popup starts open — where Node has no global
   * `getComputedStyle`. It goes through the injected document's window now,
   * which an isolated document (like the server's) may not have.
   */
  it("resolves the swatch colour through the injected document's window", async () => {
    const isolated = document.implementation.createHTMLDocument('popup');
    await TestBed.configureTestingModule({
      imports: [MlvColorPickerPopup],
      providers: [
        provideMlvI18nTesting(),
        { provide: DOCUMENT, useValue: isolated },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvColorPickerPopup);
    const hostEl: HTMLElement = fixture.nativeElement;
    fixture.componentRef.setInput('opened', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const swatch = hostEl.querySelector(
      '.mlv-color-picker-popup__swatch-color',
    );
    expect(swatch, 'the field presentation renders its swatch').toBeTruthy();

    const ambient = vi.spyOn(globalThis, 'getComputedStyle');
    fixture.componentRef.setInput('value', 'var(--brand)');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      ambient.mock.calls.filter(([element]) => element === swatch).length,
    ).toBe(0);
    // No window to resolve against: the picker falls back to its default.
    expect(
      (
        fixture.componentInstance as unknown as { _pickerValue(): string }
      )._pickerValue(),
    ).toBe('#ff0000');
    fixture.destroy();
  });
});
