import { TestBed } from '@angular/core/testing';
import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvSelect } from './select';

/**
 * Zoneless regression guard.
 *
 * Every Malva UI component is `OnPush` and signal-based, so the library is
 * meant to run under `provideZonelessChangeDetection()` — no `zone.js`. That
 * only holds while every asynchronous path (overlay attach, option commit,
 * value write-back) lands in a signal: a `setTimeout` or promise callback that
 * mutates a plain field repaints under `zone.js` and silently does nothing
 * without it. This renders the most overlay- and async-heavy control in the
 * library with zones removed and proves the DOM actually updates.
 */
@Component({
  selector: 'mlv-zoneless-host',
  imports: [MlvSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-select
      label="Fruit"
      placeholder="Choose a fruit..."
      [options]="options()"
      [(value)]="value"
    />
  `,
})
class ZonelessHost {
  readonly options = signal(['Apple', 'Banana', 'Cherry']);
  readonly value = signal<string | null>(null);
}

describe('MlvSelect — zoneless', () => {
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZonelessHost],
      providers: [provideZonelessChangeDetection(), provideMlvI18nTesting()],
    }).compileComponents();
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  it('opens its panel and commits a selection without zone.js', async () => {
    const fixture = TestBed.createComponent(ZonelessHost);
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector(
      '.mlv-select__trigger',
    ) as HTMLElement;
    expect(trigger).not.toBeNull();

    trigger.click();
    await fixture.whenStable();

    const options = Array.from(
      overlayContainer
        .getContainerElement()
        .querySelectorAll<HTMLElement>('[role="option"]'),
    );
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Apple',
      'Banana',
      'Cherry',
    ]);

    options[1].click();
    await fixture.whenStable();

    // The model write-back and the re-rendered trigger label both depend on a
    // change-detection pass that only a signal write can schedule here.
    expect(fixture.componentInstance.value()).toBe('Banana');
    expect(trigger.textContent).toContain('Banana');
  });

  it('reflects an external signal change into the trigger without zone.js', async () => {
    const fixture = TestBed.createComponent(ZonelessHost);
    await fixture.whenStable();

    fixture.componentInstance.value.set('Cherry');
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector(
      '.mlv-select__trigger',
    ) as HTMLElement;
    expect(trigger.textContent).toContain('Cherry');
  });
});
