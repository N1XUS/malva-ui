import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { Component, signal } from '@angular/core';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { ukLanguage } from '@malva-ui/i18n/uk';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvFileUpload } from './file-upload';

/**
 * #371: the drop zone's heading and its browse button defaulted to the English
 * `title` ("Drag & drop files here") and `actionLabel` ("Browse files") in
 * every locale. Both now resolve from optional `fileUpload` keys, English
 * fallback per key; explicit inputs still win.
 */
@Component({
  imports: [MlvFileUpload],
  template: `@if (override()) {
      <mlv-file-upload
        label="Attachments"
        title="Drop your invoices"
        actionLabel="Pick invoices"
      />
    } @else {
      <mlv-file-upload label="Attachments" />
    }`,
})
class UploadHost {
  readonly override = signal(false);
}

/** The English pack with both #371 `fileUpload` keys replaced by markers. */
const markerPack = {
  ...enLanguage,
  fileUpload: {
    ...enLanguage.fileUpload,
    dropFiles: 'DROP-HERE',
    browseFiles: 'BROWSE',
  },
} as MlvLanguage;

/** An older pack whose slice predates the #371 keys. */
const legacyPack = (() => {
  const fileUpload: Record<string, unknown> = { ...enLanguage.fileUpload };
  delete fileUpload['dropFiles'];
  delete fileUpload['browseFiles'];
  return { ...enLanguage, fileUpload } as unknown as MlvLanguage;
})();

describe('MlvFileUpload — i18n of the drop zone (#371)', () => {
  let fixture: ComponentFixture<UploadHost>;

  const root = () => fixture.nativeElement as HTMLElement;

  async function render(
    providers: (Provider | EnvironmentProviders)[],
    pack?: MlvLanguage,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [UploadHost],
      providers,
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture = TestBed.createComponent(UploadHost);
    await settle();
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function strings(): { title: string; action: string } {
    const title = root().querySelector('.mlv-file-upload__zone-title');
    const action = root().querySelector(
      '.mlv-file-upload__zone-action > button',
    );
    return {
      title: (title?.textContent ?? '').trim(),
      action: (action?.textContent ?? '').trim(),
    };
  }

  const english = { title: 'Drag & drop files here', action: 'Browse files' };

  it('renders the English strings under the testing pack', async () => {
    await render([provideMlvI18nTesting()]);
    expect(strings()).toEqual(english);
  });

  it('falls back to English for a pack that omits the keys', async () => {
    await withPack(legacyPack);
    expect(strings()).toEqual(english);
  });

  it('reads both strings from the active pack', async () => {
    await withPack(markerPack);
    expect(strings()).toEqual({ title: 'DROP-HERE', action: 'BROWSE' });
  });

  it('renders the German pack and follows a live switch to Ukrainian', async () => {
    await withPack(deLanguage);
    expect(strings()).toEqual({
      title: 'Dateien hierher ziehen und ablegen',
      action: 'Dateien durchsuchen',
    });

    TestBed.inject(MlvI18nService).setLanguage(ukLanguage);
    await settle();
    expect(strings()).toEqual({
      title: 'Перетягніть файли сюди',
      action: 'Вибрати файли',
    });
  });

  it('keeps explicit title and actionLabel over the pack', async () => {
    await withPack(deLanguage);
    fixture.componentInstance.override.set(true);
    await settle();
    expect(strings()).toEqual({
      title: 'Drop your invoices',
      action: 'Pick invoices',
    });
  });

  it('has no axe violations with a localized pack', async () => {
    await withPack(deLanguage);
    await expectNoAxeViolations(root());
  });
});
