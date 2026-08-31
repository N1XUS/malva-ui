import type { ModelSignal, OutputEmitterRef } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import { MlvColorPickerPopup } from './color-picker-popup';

interface ColorPickerCompositionContract {
  readonly triggerElement: () => HTMLElement | null;
  readonly panelElement: () => HTMLElement | null;
  readonly opened: ModelSignal<boolean>;
  readonly afterOpened: OutputEmitterRef<void>;
  readonly afterClosed: OutputEmitterRef<void>;
}

describe('MlvColorPickerPopup composition', () => {
  let fixture: ComponentFixture<MlvColorPickerPopup>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvColorPickerPopup],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvColorPickerPopup);
    overlayContainer = TestBed.inject(OverlayContainer);
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    overlayContainer.ngOnDestroy();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function completeClose(): Promise<void> {
    overlayContainer
      .getContainerElement()
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await settle();
  }

  it('keeps the default field presentation DOM intact', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('mlv-form-control-wrapper')).not.toBeNull();
    expect(root.querySelector('.mlv-color-picker-popup__input')).not.toBeNull();
    expect(
      root.querySelector('.mlv-color-picker-popup__swatch-button'),
    ).not.toBeNull();
  });

  it('renders a real Malva swatch trigger and exposes detached lifecycle elements', async () => {
    fixture.componentRef.setInput('presentation', 'swatch');
    fixture.componentRef.setInput('ariaLabel', 'Text color');
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector(
      'button.mlv-button[aria-label="Text color"]',
    ) as HTMLButtonElement | null;
    const contract =
      fixture.componentInstance as unknown as ColorPickerCompositionContract;

    expect(root.querySelector('.mlv-color-picker-popup__input')).toBeNull();
    expect(trigger).not.toBeNull();
    expect(contract.triggerElement()).toBe(trigger);
    expect(contract.panelElement()).toBeNull();

    trigger?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(contract.panelElement()).toBe(
      overlayContainer
        .getContainerElement()
        .querySelector('.mlv-color-picker-popup__panel'),
    );
    expect(
      overlayContainer
        .getContainerElement()
        .querySelector('.mlv-popup')
        ?.getAttribute('aria-label'),
    ).toBe('Text color');
  });

  it('reports open/close lifecycle, restores the swatch trigger on Escape, and clears detached references', async () => {
    fixture.componentRef.setInput('presentation', 'swatch');
    fixture.componentRef.setInput('ariaLabel', 'Highlight color');
    await settle();
    const contract =
      fixture.componentInstance as unknown as ColorPickerCompositionContract;
    const opened = vi.fn();
    const closed = vi.fn();
    contract.afterOpened.subscribe(opened);
    contract.afterClosed.subscribe(closed);
    const trigger = contract.triggerElement() as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    await settle();
    const panel = contract.panelElement();
    expect(contract.opened()).toBe(true);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(panel).not.toBeNull();

    panel?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    await completeClose();

    expect(contract.opened()).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(contract.panelElement()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('uses a localized real Malva button for clearable swatch composition', async () => {
    fixture.componentRef.setInput('presentation', 'swatch');
    fixture.componentRef.setInput('ariaLabel', 'Text color');
    fixture.componentRef.setInput('clearable', true);
    await settle();
    const contract =
      fixture.componentInstance as unknown as ColorPickerCompositionContract;

    contract.triggerElement()?.click();
    await settle();
    const clear = contract
      .panelElement()
      ?.querySelector(
        'button.mlv-button.mlv-color-picker-popup__clear',
      ) as HTMLButtonElement | null;
    expect(clear?.textContent?.trim()).toBe('Clear');

    clear?.click();
    await settle();
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('clears the detached panel and emits one close lifecycle event when destroyed open', async () => {
    fixture.componentRef.setInput('presentation', 'swatch');
    fixture.componentRef.setInput('ariaLabel', 'Text color');
    await settle();
    const contract =
      fixture.componentInstance as unknown as ColorPickerCompositionContract;
    const closed = vi.fn();
    contract.afterClosed.subscribe(closed);
    contract.triggerElement()?.click();
    await settle();
    expect(contract.panelElement()).not.toBeNull();

    fixture.destroy();

    expect(contract.panelElement()).toBeNull();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(
      overlayContainer
        .getContainerElement()
        .querySelector('.mlv-color-picker-popup__panel'),
    ).toBeNull();
  });
});
