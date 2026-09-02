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
 * The whole workspace test environment is zoneless — every project declares
 * `setupTestBed({ zoneless: true })` and
 * `scripts/testing/setup-assert-zoneless.js` fails the suite if the resolved
 * injector says otherwise — so running without zones is no longer what makes
 * this file worth keeping.
 *
 * What it pins is the library-side half of that contract: the mode only buys
 * working components while every asynchronous path (overlay attach, option
 * commit, value write-back) lands in a signal. A `setTimeout` or promise
 * callback that mutates a plain field would repaint under `zone.js` and
 * silently do nothing here, and a spec that asserted component state alone
 * would not notice. This one drives the most overlay- and async-heavy control
 * in the library through the DOM and reads the rendered text back.
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

  it('repaints its panel and trigger through signal writes alone', async () => {
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

  it('reflects an external signal change into the trigger', async () => {
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
