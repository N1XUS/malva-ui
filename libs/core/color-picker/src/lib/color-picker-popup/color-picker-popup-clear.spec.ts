import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvColorPickerPopup } from './color-picker-popup';

/**
 * #301: `mlv-color-picker-popup` worked around the wrapper's ungated X by
 * claiming `ownsClearButton` while readonly — but only while readonly. A
 * disabled picker still rendered the X, its inner `<button>` stayed in the tab
 * order (the wrapper's `--disabled` only sets `pointer-events: none`), and its
 * handler silently refused: a focusable "Clear" that did nothing.
 */
describe('MlvColorPickerPopup — wrapper clear button write permission (#301)', () => {
  let fixture: ComponentFixture<MlvColorPickerPopup>;

  async function render(
    state: 'writable' | 'readonly' | 'disabled',
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MlvColorPickerPopup],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvColorPickerPopup);
    fixture.componentRef.setInput('label', 'Brand color');
    fixture.componentRef.setInput('clearable', true);
    fixture.componentRef.setInput('value', '#ff0000');
    fixture.componentRef.setInput('readonly', state === 'readonly');
    fixture.componentRef.setInput('disabled', state === 'disabled');
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  const clearButton = (): HTMLButtonElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-form-control-wrapper__clear button',
    );

  const sweep = (): Promise<void> =>
    expectNoAxeViolations(fixture.nativeElement as HTMLElement, {
      // NARROWED, not clean: `aria-allowed-attr` fires on
      // `.mlv-color-picker-popup__input` — `aria-expanded` is not a supported
      // attribute of the implicit `textbox` role of `<input type="text">`.
      // Measured in every `field` state (writable with and without a value,
      // readonly, disabled), so it is independent of the clear button.
      // Fixable, deferred: tracked in #426 (the input wants `role="combobox"`,
      // or `aria-expanded` left to the swatch button alone).
      rules: { 'aria-allowed-attr': { enabled: false } },
    });

  it('clears the committed value from the clear button while writable', async () => {
    await render('writable');
    expect(clearButton()).not.toBeNull();
    await sweep();

    clearButton()?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('');
    expect(clearButton()).toBeNull();
  });

  it.each(['readonly', 'disabled'] as const)(
    'renders no clear button while %s',
    async (state) => {
      await render(state);

      expect(clearButton()).toBeNull();
      expect(fixture.componentInstance.value()).toBe('#ff0000');

      await sweep();
    },
  );
});
