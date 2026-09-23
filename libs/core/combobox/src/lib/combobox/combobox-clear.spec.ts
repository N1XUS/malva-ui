import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvCombobox } from './combobox';

@Component({
  template: `<mlv-combobox
    label="Fruit"
    clearable
    [options]="['Apple', 'Banana']"
    [readonly]="readonly()"
    [disabled]="disabled()"
    [(value)]="value"
  />`,
  imports: [MlvCombobox],
})
class Host {
  readonly combobox = viewChild.required(MlvCombobox<string>);
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly value = signal<string | string[] | null>('Apple');
}

/**
 * #301 sibling sweep: the combobox's inline X was already hidden while
 * readonly or disabled, but its *keyboard* clear — Escape on a closed
 * combobox — called `onClear()` with no permission check. A readonly combobox
 * keeps its `<input>` focusable, so one Escape emptied it.
 */
describe('MlvCombobox — Escape-to-clear write permission (#301)', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => TestBed.inject(OverlayContainer).ngOnDestroy());

  const input = (): HTMLInputElement =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-combobox__input input',
    ) as HTMLInputElement;

  function escape(): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    input().dispatchEvent(event);
    return event;
  }

  it('clears the selection on Escape while closed and writable', async () => {
    escape();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('keeps the selection on Escape while readonly', async () => {
    fixture.componentInstance.readonly.set(true);
    await fixture.whenStable();
    expect(input().readOnly).toBe(true);

    escape();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('Apple');
    expect(
      fixture.componentInstance.combobox().selectionService.selectedValues(),
    ).toEqual(['Apple']);
  });

  it('keeps the selection when the Escape handler runs while disabled', async () => {
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();

    // A disabled `<input>` takes no keyboard focus, so drive the handler the
    // template binds directly.
    fixture.componentInstance
      .combobox()
      .onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('Apple');
  });
});
