import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Canonical key names accepted by the `keys` input.
 * These map to human-readable labels and OS-specific symbols.
 */
export type MlvKbdKey =
  | 'cmd'
  | 'command'
  | 'ctrl'
  | 'control'
  | 'shift'
  | 'alt'
  | 'option'
  | 'meta'
  | 'enter'
  | 'return'
  | 'backspace'
  | 'delete'
  | 'escape'
  | 'esc'
  | 'tab'
  | 'space'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'home'
  | 'end'
  | 'pageup'
  | 'pagedown'
  | (string & {});

/** Resolved label/symbol for a single key. */
export interface MlvResolvedKey {
  /** Display label rendered inside the `<kbd>` element. */
  label: string;
  /** Original key name, for aria labelling. */
  key: string;
}

/** Returns `true` when running in a macOS browser. */
function isMacPlatform(platformId: object): boolean {
  if (!isPlatformBrowser(platformId)) return false;
  return (
    /mac/i.test(navigator.platform ?? '') || /mac/i.test(navigator.userAgent)
  );
}

const MAC_LABELS: Record<string, string> = {
  cmd: '⌘',
  command: '⌘',
  meta: '⌘',
  ctrl: '⌃',
  control: '⌃',
  shift: '⇧',
  alt: '⌥',
  option: '⌥',
  enter: '↵',
  return: '↵',
  backspace: '⌫',
  delete: '⌦',
  escape: '⎋',
  esc: '⎋',
  tab: '⇥',
  space: '␣',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn',
};

const WIN_LABELS: Record<string, string> = {
  cmd: 'Ctrl',
  command: 'Ctrl',
  meta: 'Win',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
  enter: 'Enter',
  return: 'Enter',
  backspace: 'Backspace',
  delete: 'Del',
  escape: 'Esc',
  esc: 'Esc',
  tab: 'Tab',
  space: 'Space',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn',
};

/** Resolves a raw key string to a display label for the given OS. */
function resolveKeyLabel(key: string, isMac: boolean): string {
  const normalized = key.toLowerCase();
  const map = isMac ? MAC_LABELS : WIN_LABELS;
  return map[normalized] ?? key.toUpperCase();
}

/**
 * Keyboard shortcut display component. Renders an array of key names
 * as styled `<kbd>` elements separated by a configurable separator.
 *
 * OS detection swaps modifier labels: Mac shows `⌘`, `⌃`, `⇧`, `⌥`;
 * Windows/Linux shows `Ctrl`, `Shift`, `Alt`, etc.
 *
 * @example
 * ```html
 * <!-- Renders ⌘ + K on Mac, Ctrl + K on Windows -->
 * <mlv-kbd [keys]="['cmd', 'k']" />
 *
 * <!-- Custom separator -->
 * <mlv-kbd [keys]="['ctrl', 'shift', 'p']" separator=" " />
 * ```
 */
@Component({
  selector: 'mlv-kbd',
  templateUrl: './kbd.html',
  styleUrl: './kbd.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  host: {
    class: 'mlv-kbd',
    'aria-label': '',
    '[attr.aria-label]': '_ariaLabel()',
  },
})
export class MlvKbd {
  /**
   * The ordered list of key names to display.
   * Accepts canonical names (`'cmd'`, `'shift'`, `'enter'`, etc.) or any
   * plain string which will be uppercased as a fallback label.
   *
   * @example `['cmd', 'k']` → `⌘ + K` (Mac) / `Ctrl + K` (Win)
   */
  readonly keys = input.required<MlvKbdKey[]>();

  /**
   * The string rendered between each key element.
   * Defaults to `'+'`.
   */
  readonly separator = input<string>('+');

  /** @private Resolved OS flag — true on macOS browsers. */
  private readonly _isMac = isMacPlatform(inject(PLATFORM_ID));

  /** @protected Resolved key labels for the template. */
  protected readonly _resolvedKeys = computed<MlvResolvedKey[]>(() =>
    this.keys().map((k) => ({
      key: k,
      label: resolveKeyLabel(k, this._isMac),
    })),
  );

  /** @private Accessible label joining all resolved key names. */
  protected readonly _ariaLabel = computed(() =>
    this._resolvedKeys()
      .map((rk) => rk.label)
      .join(' ' + this.separator() + ' '),
  );
}
