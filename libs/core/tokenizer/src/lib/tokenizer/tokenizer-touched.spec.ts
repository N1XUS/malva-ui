import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTokenizer } from './tokenizer';

type Token = MlvSelectOption<string>;

@Component({
  template: `
    <mlv-tokenizer [formControl]="tags" (touch)="touches = touches + 1" />
    <button type="button" class="outside">Save</button>
  `,
  imports: [MlvTokenizer, ReactiveFormsModule],
})
class TagsHost {
  /** How many times the tokenizer emitted `touch`. */
  touches = 0;

  readonly tags = new FormControl<Token[]>(
    [
      { label: 'Angular', value: 'angular' },
      { label: 'React', value: 'react' },
    ],
    { nonNullable: true },
  );
}

/**
 * #347 (owner decision D22), and a tokenizer that never touched at all: its
 * `(focus)` / `(blur)` sat on the `<mlv-input>` element, which the native
 * input's non-bubbling focus events never reach, so in a browser `focused()`
 * stayed `false` and leaving the field reported nothing. Focus is moved for
 * real here — no hand-dispatched `blur`. Every assertion reads a primitive,
 * so a failure never pretty-prints a component.
 */
describe('MlvTokenizer — focus and touched timing (#347)', () => {
  let fixture: ComponentFixture<TagsHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(TagsHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function nativeInput(): HTMLInputElement {
    return root().querySelector(
      '.mlv-tokenizer__input .mlv-input__native',
    ) as HTMLInputElement;
  }

  function tabbableToken(): HTMLElement {
    return root().querySelector('mlv-token[tabindex="0"]') as HTMLElement;
  }

  function tokenizerHost(): HTMLElement {
    return root().querySelector('mlv-tokenizer') as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('reports focused while its text input has focus', async () => {
    nativeInput().focus();
    await settle();

    expect(tokenizerHost().classList.contains('mlv-tokenizer--focused')).toBe(
      true,
    );
  });

  it('does not touch when focus moves between the input and a token', async () => {
    nativeInput().focus();
    tabbableToken().focus();
    nativeInput().focus();
    await settle();

    expect(fixture.componentInstance.tags.touched).toBe(false);
    expect(tokenizerHost().classList.contains('mlv-tokenizer--focused')).toBe(
      true,
    );
  });

  it('marks the control touched and unfocused once focus leaves it', async () => {
    nativeInput().focus();
    (root().querySelector('.outside') as HTMLButtonElement).focus();
    await settle();

    expect(fixture.componentInstance.tags.touched).toBe(true);
    expect(tokenizerHost().classList.contains('mlv-tokenizer--focused')).toBe(
      false,
    );
  });

  // Disabling removes the focused text input. jsdom, like Firefox and WebKit,
  // fires no `focusout` for a removed element, so nothing but the disable
  // itself can end the focus session.
  it('drops focus and reports touched once when disabled while its input has focus', async () => {
    nativeInput().focus();
    await settle();

    fixture.componentInstance.tags.disable();
    await settle();

    expect(nativeInput() === null).toBe(true);
    expect(tokenizerHost().classList.contains('mlv-tokenizer--focused')).toBe(
      false,
    );
    expect(fixture.componentInstance.tags.touched).toBe(true);
    expect(fixture.componentInstance.touches).toBe(1);
  });

  // Chromium does fire `focusout` (to no element) for the removed input, after
  // the disable has already reported the leave.
  it('does not report the leave twice when the removed input fires focusout', async () => {
    nativeInput().focus();
    await settle();

    fixture.componentInstance.tags.disable();
    await settle();
    tokenizerHost().dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
    );
    await settle();

    expect(fixture.componentInstance.touches).toBe(1);
  });
});
