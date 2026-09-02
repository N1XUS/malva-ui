import {
  type EnvironmentProviders,
  type InjectionToken,
  type Provider,
  type Signal,
  makeEnvironmentProviders,
  signal,
} from '@angular/core';
import {
  MLV_ALERT_I18N,
  MLV_AVATAR_GROUP_I18N,
  MLV_BOTTOM_NAV_I18N,
  MLV_BREADCRUMB_I18N,
  MLV_CALENDAR_I18N,
  MLV_CHAT_I18N,
  MLV_CHIP_I18N,
  MLV_COLOR_PICKER_I18N,
  MLV_COMBOBOX_I18N,
  MLV_COMPARE_I18N,
  MLV_COPY_TO_CLIPBOARD_I18N,
  MLV_DATA_TABLE_I18N,
  MLV_DATE_RANGE_PICKER_I18N,
  MLV_DAY_PICKER_I18N,
  MLV_DIALOG_I18N,
  MLV_DRAWER_I18N,
  MLV_EDITOR_I18N,
  MLV_FILE_UPLOAD_I18N,
  MLV_FILTER_I18N,
  MLV_FORM_UTILS_I18N,
  MLV_LOADER_I18N,
  MLV_NOTIFICATION_I18N,
  MLV_NUMBER_INPUT_I18N,
  MLV_PAGINATION_I18N,
  MLV_PIN_INPUT_I18N,
  MLV_POPUP_I18N,
  MLV_PROGRESS_I18N,
  MLV_RATING_I18N,
  MLV_SCROLLBAR_I18N,
  MLV_SEARCH_FIELD_I18N,
  MLV_SELECT_I18N,
  MLV_SIDEBAR_I18N,
  MLV_SLIDER_I18N,
  MLV_STEPPER_I18N,
  MLV_TABS_I18N,
  MLV_TILE_I18N,
  MLV_TIME_PICKER_I18N,
  MLV_TOAST_I18N,
  MLV_TOKENIZER_I18N,
} from '@malva-ui/i18n';
import { enLanguage as en } from '@malva-ui/i18n/en';

/**
 * Lookup table of every i18n token with its English default slice.
 * Used by `provideMlvI18nTesting()` to build the full provider array
 * and by `i18nTestProvider(token, overrides?)` for one-off stubs.
 */
const I18N_TOKEN_DEFAULTS: ReadonlyArray<
  readonly [InjectionToken<Signal<unknown>>, unknown]
> = [
  [MLV_ALERT_I18N, en.alert],
  [MLV_AVATAR_GROUP_I18N, en.avatarGroup],
  [MLV_BOTTOM_NAV_I18N, en.bottomNav],
  [MLV_BREADCRUMB_I18N, en.breadcrumb],
  [MLV_CALENDAR_I18N, en.calendar],
  [MLV_CHAT_I18N, en.chat],
  [MLV_CHIP_I18N, en.chip],
  [MLV_COLOR_PICKER_I18N, en.colorPicker],
  [MLV_COMBOBOX_I18N, en.combobox],
  [MLV_COMPARE_I18N, en.compare],
  [MLV_COPY_TO_CLIPBOARD_I18N, en.copyToClipboard],
  [MLV_DATA_TABLE_I18N, en.dataTable],
  [MLV_DATE_RANGE_PICKER_I18N, en.dateRangePicker],
  [MLV_DAY_PICKER_I18N, en.dayPicker],
  [MLV_DIALOG_I18N, en.dialog],
  [MLV_DRAWER_I18N, en.drawer],
  [MLV_EDITOR_I18N, en.editor],
  [MLV_FILE_UPLOAD_I18N, en.fileUpload],
  [MLV_FILTER_I18N, en.filter],
  [MLV_FORM_UTILS_I18N, en.formUtils],
  [MLV_LOADER_I18N, en.loader],
  [MLV_NOTIFICATION_I18N, en.notification],
  [MLV_NUMBER_INPUT_I18N, en.numberInput],
  [MLV_PAGINATION_I18N, en.pagination],
  [MLV_PIN_INPUT_I18N, en.pinInput],
  [MLV_POPUP_I18N, en.popup],
  [MLV_PROGRESS_I18N, en.progress],
  [MLV_RATING_I18N, en.rating],
  [MLV_SCROLLBAR_I18N, en.scrollbar],
  [MLV_SEARCH_FIELD_I18N, en.searchField],
  [MLV_SELECT_I18N, en.select],
  [MLV_SIDEBAR_I18N, en.sidebar],
  [MLV_SLIDER_I18N, en.slider],
  [MLV_STEPPER_I18N, en.stepper],
  [MLV_TABS_I18N, en.tabs],
  [MLV_TILE_I18N, en.tile],
  [MLV_TIME_PICKER_I18N, en.timePicker],
  [MLV_TOAST_I18N, en.toast],
  [MLV_TOKENIZER_I18N, en.tokenizer],
];

/**
 * Provides every Malva UI component i18n token with its English default
 * wrapped in a signal. Drop this into `TestBed.configureTestingModule`'s
 * `providers` array to satisfy the `inject(MLV_*_I18N)` calls that every
 * i18n-aware component performs at construction.
 *
 * @example
 * ```ts
 * await TestBed.configureTestingModule({
 *   imports: [MlvMlvAlert],
 *   providers: [provideMlvI18nTesting()],
 * }).compileComponents();
 * ```
 */
export function provideMlvI18nTesting(): EnvironmentProviders {
  const providers: Provider[] = I18N_TOKEN_DEFAULTS.map(([token, value]) => ({
    provide: token,
    useValue: signal(value),
  }));
  return makeEnvironmentProviders(providers);
}

/**
 * Provides a single i18n token with the English default merged with
 * an optional override. Use when only one token needs custom values
 * for a specific spec.
 *
 * @example
 * ```ts
 * await TestBed.configureTestingModule({
 *   imports: [MlvMlvAlert],
 *   providers: [
 *     i18nTestProvider(MLV_ALERT_I18N, { dismiss: 'Close' }),
 *   ],
 * }).compileComponents();
 * ```
 */
export function i18nTestProvider<T>(
  token: InjectionToken<Signal<T>>,
  overrides?: Partial<T>,
): Provider {
  const entry = I18N_TOKEN_DEFAULTS.find(([t]) => t === token);
  if (!entry) {
    throw new Error(
      'i18nTestProvider: unknown token. Pass one of the MLV_*_I18N exports from @malva-ui/i18n.',
    );
  }
  const defaultValue = entry[1] as T;
  const merged = overrides ? { ...defaultValue, ...overrides } : defaultValue;
  return { provide: token, useValue: signal(merged) };
}
