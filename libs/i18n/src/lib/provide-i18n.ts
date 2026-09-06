import {
  APP_INITIALIZER,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { MlvI18nService } from './i18n.service';
import type { MlvLanguage } from './types';

import { MLV_ALERT_I18N } from './tokens/alert';
import { MLV_AVATAR_GROUP_I18N } from './tokens/avatar-group';
import { MLV_BOTTOM_NAV_I18N } from './tokens/bottom-nav';
import { MLV_BREADCRUMB_I18N } from './tokens/breadcrumb';
import { MLV_CALENDAR_I18N } from './tokens/calendar';
import { MLV_CHAT_I18N } from './tokens/chat';
import { MLV_CHIP_I18N } from './tokens/chip';
import { MLV_COLOR_PICKER_I18N } from './tokens/color-picker';
import { MLV_COMBOBOX_I18N } from './tokens/combobox';
import { MLV_COMPARE_I18N } from './tokens/compare';
import { MLV_COPY_TO_CLIPBOARD_I18N } from './tokens/copy-to-clipboard';
import { MLV_DATA_TABLE_I18N } from './tokens/data-table';
import { MLV_DATE_RANGE_PICKER_I18N } from './tokens/date-range-picker';
import { MLV_DAY_PICKER_I18N } from './tokens/day-picker';
import { MLV_DIALOG_I18N } from './tokens/dialog';
import { MLV_DRAWER_I18N } from './tokens/drawer';
import { MLV_EDITOR_I18N } from './tokens/editor';
import { MLV_FILE_UPLOAD_I18N } from './tokens/file-upload';
import { MLV_FILTER_I18N } from './tokens/filter';
import { MLV_FORM_UTILS_I18N } from './tokens/form-utils';
import { MLV_LOADER_I18N } from './tokens/loader';
import { MLV_NOTIFICATION_I18N } from './tokens/notification';
import { MLV_NUMBER_INPUT_I18N } from './tokens/number-input';
import { MLV_PAGINATION_I18N } from './tokens/pagination';
import { MLV_PIN_INPUT_I18N } from './tokens/pin-input';
import { MLV_POPUP_I18N } from './tokens/popup';
import { MLV_PROGRESS_I18N } from './tokens/progress';
import { MLV_RATING_I18N } from './tokens/rating';
import { MLV_SCHEDULER_I18N } from './tokens/scheduler';
import { MLV_SCROLLBAR_I18N } from './tokens/scrollbar';
import { MLV_SEARCH_FIELD_I18N } from './tokens/search-field';
import { MLV_SELECT_I18N } from './tokens/select';
import { MLV_SIDEBAR_I18N } from './tokens/sidebar';
import { MLV_SLIDER_I18N } from './tokens/slider';
import { MLV_STEPPER_I18N } from './tokens/stepper';
import { MLV_TABS_I18N } from './tokens/tabs';
import { MLV_TILE_I18N } from './tokens/tile';
import { MLV_TIME_PICKER_I18N } from './tokens/time-picker';
import { MLV_TOAST_I18N } from './tokens/toast';
import { MLV_TOKENIZER_I18N } from './tokens/tokenizer';

/** @private Internal token for the APP_INITIALIZER factory. */
const MLV_I18N_INITIALIZER = new InjectionToken<() => Promise<void>>(
  'MLV_I18N_INITIALIZER',
);

/**
 * Provides the Malva UI i18n system with a lazy-loaded language pack.
 * Must be called in the application's root providers.
 *
 * @example
 * ```ts
 * export const appConfig = {
 *   providers: [
 *     provideMlvI18n(() => import('@malva-ui/i18n/en')),
 *   ],
 * };
 * ```
 */
export function provideMlvI18n(
  loader: () => Promise<{ default: MlvLanguage }>,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    MlvI18nService,
    {
      provide: MLV_I18N_INITIALIZER,
      useFactory: () => {
        const i18nService = inject(MlvI18nService);
        return () => loader().then((m) => i18nService.setLanguage(m.default));
      },
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => inject(MLV_I18N_INITIALIZER),
      multi: true,
    },
    {
      provide: MLV_ALERT_I18N,
      useFactory: () => inject(MlvI18nService).select('alert'),
    },
    {
      provide: MLV_AVATAR_GROUP_I18N,
      useFactory: () => inject(MlvI18nService).select('avatarGroup'),
    },
    {
      provide: MLV_BOTTOM_NAV_I18N,
      useFactory: () => inject(MlvI18nService).select('bottomNav'),
    },
    {
      provide: MLV_BREADCRUMB_I18N,
      useFactory: () => inject(MlvI18nService).select('breadcrumb'),
    },
    {
      provide: MLV_CALENDAR_I18N,
      useFactory: () => inject(MlvI18nService).select('calendar'),
    },
    {
      provide: MLV_CHAT_I18N,
      useFactory: () => inject(MlvI18nService).select('chat'),
    },
    {
      provide: MLV_CHIP_I18N,
      useFactory: () => inject(MlvI18nService).select('chip'),
    },
    {
      provide: MLV_COLOR_PICKER_I18N,
      useFactory: () => inject(MlvI18nService).select('colorPicker'),
    },
    {
      provide: MLV_COMBOBOX_I18N,
      useFactory: () => inject(MlvI18nService).select('combobox'),
    },
    {
      provide: MLV_COMPARE_I18N,
      useFactory: () => inject(MlvI18nService).select('compare'),
    },
    {
      provide: MLV_COPY_TO_CLIPBOARD_I18N,
      useFactory: () => inject(MlvI18nService).select('copyToClipboard'),
    },
    {
      provide: MLV_DATA_TABLE_I18N,
      useFactory: () => inject(MlvI18nService).select('dataTable'),
    },
    {
      provide: MLV_DATE_RANGE_PICKER_I18N,
      useFactory: () => inject(MlvI18nService).select('dateRangePicker'),
    },
    {
      provide: MLV_DAY_PICKER_I18N,
      useFactory: () => inject(MlvI18nService).select('dayPicker'),
    },
    {
      provide: MLV_DIALOG_I18N,
      useFactory: () => inject(MlvI18nService).select('dialog'),
    },
    {
      provide: MLV_DRAWER_I18N,
      useFactory: () => inject(MlvI18nService).select('drawer'),
    },
    {
      provide: MLV_EDITOR_I18N,
      useFactory: () => inject(MlvI18nService).select('editor'),
    },
    {
      provide: MLV_FILE_UPLOAD_I18N,
      useFactory: () => inject(MlvI18nService).select('fileUpload'),
    },
    {
      provide: MLV_FILTER_I18N,
      useFactory: () => inject(MlvI18nService).select('filter'),
    },
    {
      provide: MLV_FORM_UTILS_I18N,
      useFactory: () => inject(MlvI18nService).select('formUtils'),
    },
    {
      provide: MLV_LOADER_I18N,
      useFactory: () => inject(MlvI18nService).select('loader'),
    },
    {
      provide: MLV_NOTIFICATION_I18N,
      useFactory: () => inject(MlvI18nService).select('notification'),
    },
    {
      provide: MLV_NUMBER_INPUT_I18N,
      useFactory: () => inject(MlvI18nService).select('numberInput'),
    },
    {
      provide: MLV_PAGINATION_I18N,
      useFactory: () => inject(MlvI18nService).select('pagination'),
    },
    {
      provide: MLV_PIN_INPUT_I18N,
      useFactory: () => inject(MlvI18nService).select('pinInput'),
    },
    {
      provide: MLV_POPUP_I18N,
      useFactory: () => inject(MlvI18nService).select('popup'),
    },
    {
      provide: MLV_PROGRESS_I18N,
      useFactory: () => inject(MlvI18nService).select('progress'),
    },
    {
      provide: MLV_RATING_I18N,
      useFactory: () => inject(MlvI18nService).select('rating'),
    },
    {
      provide: MLV_SCHEDULER_I18N,
      useFactory: () => inject(MlvI18nService).select('scheduler'),
    },
    {
      provide: MLV_SCROLLBAR_I18N,
      useFactory: () => inject(MlvI18nService).select('scrollbar'),
    },
    {
      provide: MLV_SEARCH_FIELD_I18N,
      useFactory: () => inject(MlvI18nService).select('searchField'),
    },
    {
      provide: MLV_SELECT_I18N,
      useFactory: () => inject(MlvI18nService).select('select'),
    },
    {
      provide: MLV_SIDEBAR_I18N,
      useFactory: () => inject(MlvI18nService).select('sidebar'),
    },
    {
      provide: MLV_SLIDER_I18N,
      useFactory: () => inject(MlvI18nService).select('slider'),
    },
    {
      provide: MLV_STEPPER_I18N,
      useFactory: () => inject(MlvI18nService).select('stepper'),
    },
    {
      provide: MLV_TABS_I18N,
      useFactory: () => inject(MlvI18nService).select('tabs'),
    },
    {
      provide: MLV_TILE_I18N,
      useFactory: () => inject(MlvI18nService).select('tile'),
    },
    {
      provide: MLV_TIME_PICKER_I18N,
      useFactory: () => inject(MlvI18nService).select('timePicker'),
    },
    {
      provide: MLV_TOAST_I18N,
      useFactory: () => inject(MlvI18nService).select('toast'),
    },
    {
      provide: MLV_TOKENIZER_I18N,
      useFactory: () => inject(MlvI18nService).select('tokenizer'),
    },
  ]);
}
