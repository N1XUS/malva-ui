import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  LucideMonitor,
  LucideMoon,
  LucideSettings,
  LucideSun,
} from '@lucide/angular';
import {
  MlvDensityDirective,
  MlvDensityService,
  type MlvDensity,
} from '@malva-ui/cdk/density';
import { MlvRtlService, type MlvDirection } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import { MlvThemeService, isMlvThemeMode } from '@malva-ui/core/layout';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
  type MlvPopupPositionName,
} from '@malva-ui/core/popup';
import {
  MlvSelect,
  MlvSelectItemTemplate,
  MlvSelectSelectedTemplate,
} from '@malva-ui/core/select';
import {
  MlvTab,
  MlvTabContentDef,
  MlvTabDef,
  MlvTabGroup,
} from '@malva-ui/core/tabs';
// The service contract is static; only locale data is split into lazy language packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { MlvI18nService } from '@malva-ui/i18n';
import {
  DOCS_LOCALE_CODES,
  DOCS_LOCALE_METADATA,
  docsLocaleToOption,
  type DocsLocale,
} from './docs-locales';
import { DocsLocaleService } from './docs-locale.service';

@Component({
  selector: 'docs-app-bar-preferences',
  imports: [
    MlvButton,
    MlvDensityDirective,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvSelect,
    MlvSelectItemTemplate,
    MlvSelectSelectedTemplate,
    MlvTab,
    MlvTabContentDef,
    MlvTabDef,
    MlvTabGroup,
    LucideSettings,
    LucideMonitor,
    LucideSun,
    LucideMoon,
  ],
  templateUrl: './docs-app-bar-preferences.html',
  styleUrl: './docs-app-bar-preferences.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsAppBarPreferencesComponent {
  private readonly _themeService = inject(MlvThemeService);
  private readonly _densityService = inject(MlvDensityService);
  private readonly _rtlService = inject(MlvRtlService);
  private readonly _i18nService = inject(MlvI18nService);
  private readonly _document = inject(DOCUMENT);
  private readonly _localeService = inject(DocsLocaleService);

  readonly locale = this._localeService.locale;
  readonly localeOptions = DOCS_LOCALE_CODES;
  readonly localeMetadata = DOCS_LOCALE_METADATA;
  readonly localeToOption = docsLocaleToOption;
  readonly localeLoadError = signal('');
  readonly densityOptions: readonly MlvDensity[] = [
    'compact',
    'comfortable',
    'spacious',
  ];
  readonly directionOptions: readonly MlvDirection[] = ['ltr', 'rtl'];
  readonly directionToOption = (direction: MlvDirection) => ({
    label: direction.toUpperCase(),
    value: direction,
  });
  readonly density = this._densityService.density;
  readonly direction = this._rtlService.direction;
  readonly themeMode = this._themeService.themeMode;
  readonly preferencesPositions: MlvPopupPositionName[] = [
    'bottom-end',
    'top-end',
  ];

  protected _setThemeMode(value: string): void {
    if (isMlvThemeMode(value)) this._themeService.setTheme(value);
  }

  protected _localeFlag(locale: DocsLocale): string {
    return `docs-app-bar-preferences__flag fi fi-${this.localeMetadata[locale].flag}`;
  }

  protected _setDensity(value: MlvDensity | MlvDensity[] | null): void {
    if (typeof value === 'string' && this.densityOptions.includes(value)) {
      this._densityService.setDensity(value);
    }
  }

  protected _setDirection(value: MlvDirection | MlvDirection[] | null): void {
    if (typeof value === 'string' && this.directionOptions.includes(value)) {
      this._rtlService.setDirection(value);
    }
  }

  protected async _switchLanguage(
    value: DocsLocale | DocsLocale[] | null,
  ): Promise<void> {
    if (typeof value !== 'string' || !this.localeOptions.includes(value))
      return;

    const previousLocale = this.locale();
    const requestId = this._localeService.beginLocaleRequest(value);
    this.localeLoadError.set('');

    try {
      await this._i18nService.switchLanguage(this.localeMetadata[value].load);
      if (this._localeService.isCurrentRequest(requestId)) {
        this._document.documentElement.lang = value;
      }
    } catch {
      if (this._localeService.isCurrentRequest(requestId)) {
        this._localeService.setLocale(previousLocale);
        this._document.documentElement.lang = previousLocale;
        this.localeLoadError.set(
          `Unable to load ${this.localeMetadata[value].name}. Try again.`,
        );
      }
    }
  }
}
