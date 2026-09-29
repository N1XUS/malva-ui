import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { NEVER } from 'rxjs';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { ukLanguage } from '@malva-ui/i18n/uk';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvCopyToClipboard } from './copy-to-clipboard';

/**
 * #371: the polite confirmation defaulted to the English `copiedAriaLabel`
 * ("Copied to clipboard"), and the indicator's tooltip read a hard-coded
 * "Copy" / "Copied". All three now resolve from optional
 * `copyToClipboard` keys, English fallback per key; an explicit
 * `copiedAriaLabel` still wins.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  template: `@if (override()) {
      <mlv-copy-to-clipboard copiedAriaLabel="Order number copied"
        ><code>0042</code></mlv-copy-to-clipboard
      >
    } @else {
      <mlv-copy-to-clipboard><code>0042</code></mlv-copy-to-clipboard>
    }`,
})
class CopyHost {
  readonly override = signal(false);
}

/** The English pack with every #371 `copyToClipboard` key replaced by a marker. */
const markerPack = {
  ...enLanguage,
  copyToClipboard: {
    ...enLanguage.copyToClipboard,
    copied: 'DONE',
    copyTooltip: 'TIP-COPY',
    copiedTooltip: 'TIP-COPIED',
  },
} as MlvLanguage;

/** An older pack whose slice predates the #371 keys. */
const legacyPack = {
  ...enLanguage,
  copyToClipboard: { copyToClipboard: 'Copy to clipboard' },
} as MlvLanguage;

describe('MlvCopyToClipboard — i18n of the confirmation and tooltip (#371)', () => {
  let fixture: ComponentFixture<CopyHost>;
  let copy: HTMLElement;

  async function render(
    providers: (Provider | EnvironmentProviders)[],
    pack?: MlvLanguage,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CopyHost],
      providers: [
        ...providers,
        { provide: Clipboard, useValue: { copy: () => true } },
        {
          provide: MlvResizeObserverService,
          useValue: { observe: () => NEVER },
        },
      ],
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture = TestBed.createComponent(CopyHost);
    await settle();
    copy = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-copy-to-clipboard',
    ) as HTMLElement;
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const live = () =>
    (
      copy.querySelector('.mlv-copy-to-clipboard__live')?.textContent ?? ''
    ).trim();

  /** The tooltip text, read through the description it registers. */
  function tooltip(): string {
    const ids = copy
      .querySelector('.mlv-copy-to-clipboard__indicator')
      ?.getAttribute('aria-describedby');
    return (ids ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .join(' ');
  }

  async function press(): Promise<void> {
    copy.click();
    await settle();
  }

  async function strings(): Promise<Record<string, string>> {
    const idleTooltip = tooltip();
    const idleLive = live();
    await press();
    return {
      idleTooltip,
      idleLive,
      copiedTooltip: tooltip(),
      copiedLive: live(),
    };
  }

  const english = {
    idleTooltip: 'Copy',
    idleLive: '',
    copiedTooltip: 'Copied',
    copiedLive: 'Copied to clipboard',
  };

  it('renders the English strings under the testing pack', async () => {
    await render([provideMlvI18nTesting()]);
    expect(await strings()).toEqual(english);
  });

  it('falls back to English for a pack that omits the keys', async () => {
    await withPack(legacyPack);
    expect(await strings()).toEqual(english);
  });

  it('reads every string from the active pack', async () => {
    await withPack(markerPack);
    expect(await strings()).toEqual({
      idleTooltip: 'TIP-COPY',
      idleLive: '',
      copiedTooltip: 'TIP-COPIED',
      copiedLive: 'DONE',
    });
  });

  it('renders the German pack and follows a live switch to Ukrainian', async () => {
    await withPack(deLanguage);
    expect(await strings()).toEqual({
      idleTooltip: 'Kopieren',
      idleLive: '',
      copiedTooltip: 'Kopiert',
      copiedLive: 'In die Zwischenablage kopiert',
    });

    TestBed.inject(MlvI18nService).setLanguage(ukLanguage);
    await settle();
    expect(live()).toBe('Скопійовано в буфер обміну');
    expect(tooltip()).toBe('Скопійовано');
  });

  it('keeps an explicit copiedAriaLabel over the pack', async () => {
    await withPack(deLanguage);
    fixture.componentInstance.override.set(true);
    await settle();
    copy = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-copy-to-clipboard',
    ) as HTMLElement;
    await press();
    expect(live()).toBe('Order number copied');
  });

  it('has no axe violations with a localized pack', async () => {
    await withPack(deLanguage);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    await press();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
