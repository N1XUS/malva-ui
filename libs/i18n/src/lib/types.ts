import type { MlvAlertI18n } from './tokens/alert';
import type { MlvAvatarGroupI18n } from './tokens/avatar-group';
import type { MlvBottomNavI18n } from './tokens/bottom-nav';
import type { MlvBreadcrumbI18n } from './tokens/breadcrumb';
import type { MlvCalendarI18n } from './tokens/calendar';
import type { MlvChatI18n } from './tokens/chat';
import type { MlvChipI18n } from './tokens/chip';
import type { MlvColorPickerI18n } from './tokens/color-picker';
import type { MlvComboboxI18n } from './tokens/combobox';
import type { MlvCompareI18n } from './tokens/compare';
import type { MlvCopyToClipboardI18n } from './tokens/copy-to-clipboard';
import type { MlvDataTableI18n } from './tokens/data-table';
import type { MlvDateRangePickerI18n } from './tokens/date-range-picker';
import type { MlvDayPickerI18n } from './tokens/day-picker';
import type { MlvDialogI18n } from './tokens/dialog';
import type { MlvDrawerI18n } from './tokens/drawer';
import type { MlvEditorI18n } from './tokens/editor';
import type { MlvFileUploadI18n } from './tokens/file-upload';
import type { MlvFilterI18n } from './tokens/filter';
import type { MlvFormUtilsI18n } from './tokens/form-utils';
import type { MlvLoaderI18n } from './tokens/loader';
import type { MlvNotificationI18n } from './tokens/notification';
import type { MlvNumberInputI18n } from './tokens/number-input';
import type { MlvPaginationI18n } from './tokens/pagination';
import type { MlvPinInputI18n } from './tokens/pin-input';
import type { MlvPopupI18n } from './tokens/popup';
import type { MlvProgressI18n } from './tokens/progress';
import type { MlvRatingI18n } from './tokens/rating';
import type { MlvScrollbarI18n } from './tokens/scrollbar';
import type { MlvSearchFieldI18n } from './tokens/search-field';
import type { MlvSelectI18n } from './tokens/select';
import type { MlvSidebarI18n } from './tokens/sidebar';
import type { MlvSliderI18n } from './tokens/slider';
import type { MlvStepperI18n } from './tokens/stepper';
import type { MlvTabsI18n } from './tokens/tabs';
import type { MlvTaskboardI18n } from './tokens/taskboard';
import type { MlvTileI18n } from './tokens/tile';
import type { MlvTimePickerI18n } from './tokens/time-picker';
import type { MlvToastI18n } from './tokens/toast';
import type { MlvTokenizerI18n } from './tokens/tokenizer';

/** Aggregate of all component i18n interfaces, keyed by component name. */
export interface MlvLanguage {
  alert: MlvAlertI18n;
  avatarGroup: MlvAvatarGroupI18n;
  bottomNav: MlvBottomNavI18n;
  breadcrumb: MlvBreadcrumbI18n;
  calendar: MlvCalendarI18n;
  chat: MlvChatI18n;
  chip: MlvChipI18n;
  colorPicker: MlvColorPickerI18n;
  combobox: MlvComboboxI18n;
  compare: MlvCompareI18n;
  copyToClipboard: MlvCopyToClipboardI18n;
  dataTable: MlvDataTableI18n;
  dateRangePicker: MlvDateRangePickerI18n;
  dayPicker: MlvDayPickerI18n;
  dialog: MlvDialogI18n;
  drawer: MlvDrawerI18n;
  editor: MlvEditorI18n;
  fileUpload: MlvFileUploadI18n;
  filter: MlvFilterI18n;
  formUtils: MlvFormUtilsI18n;
  loader: MlvLoaderI18n;
  notification: MlvNotificationI18n;
  numberInput: MlvNumberInputI18n;
  pagination: MlvPaginationI18n;
  pinInput: MlvPinInputI18n;
  popup: MlvPopupI18n;
  progress: MlvProgressI18n;
  rating: MlvRatingI18n;
  scrollbar: MlvScrollbarI18n;
  searchField: MlvSearchFieldI18n;
  select: MlvSelectI18n;
  sidebar: MlvSidebarI18n;
  slider: MlvSliderI18n;
  stepper: MlvStepperI18n;
  tabs: MlvTabsI18n;
  taskboard: MlvTaskboardI18n;
  tile: MlvTileI18n;
  timePicker: MlvTimePickerI18n;
  toast: MlvToastI18n;
  tokenizer: MlvTokenizerI18n;
}

/** AI translation provider interface — consumers implement this for their backend. */
export interface MlvTranslationProvider {
  /** Batch-translate multiple keys in a single API call. */
  translate(requests: MlvTranslationRequest[]): Promise<MlvTranslationResult[]>;
}

/** A single translation request sent to the provider. */
export interface MlvTranslationRequest {
  /** Dot-path key, e.g. 'pagination.previousPage'. */
  key: string;
  /** English source ICU string. */
  sourceText: string;
  /** Target locale, e.g. 'de', 'uk'. */
  targetLocale: string;
  /** Context metadata for quality translations. */
  context: MlvTranslationContext;
}

/** Result from the translation provider. */
export interface MlvTranslationResult {
  /** The dot-path key that was translated. */
  key: string;
  /** The translated ICU MessageFormat string. */
  translatedText: string;
}

/** Context metadata attached to each translatable key — consumed by AI translators. */
export interface MlvTranslationContext {
  /** Component selector, e.g. 'mlv-pagination'. */
  component: string;
  /** How the string is used in the component. */
  usage:
    | 'aria-label'
    | 'aria-valuetext'
    | 'button-text'
    | 'label'
    | 'live-announcement'
    | 'placeholder'
    | 'message';
  /** Maximum character length hint for the translation. */
  maxLength?: number;
  /** Human-readable description of what this string is for. */
  description?: string;
  /** ICU parameters the AI must preserve, e.g. ['count', 'total']. */
  icuParams?: string[];
  /** Required CLDR plural categories for the target locale. */
  pluralCategories?: string[];
}

/** Configuration for the runtime AI translation service. */
export interface MlvAiTranslationConfig {
  /** The translation provider implementation. */
  provider: MlvTranslationProvider;
  /** Target locale for AI translations. */
  targetLocale: string;
  /** Cache strategy for translated strings. */
  cache: 'memory' | 'localstorage' | 'indexeddb' | 'none';
  /** Whether AI translation is enabled globally (default: false). */
  enabled: boolean;
}
